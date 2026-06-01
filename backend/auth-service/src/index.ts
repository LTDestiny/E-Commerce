import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import Redis from "ioredis";
import crypto from "crypto";
import { config } from "./config";
import { prisma } from "./lib/prisma";
import { sendResetPasswordEmail } from "./lib/mailer";
import {
  comparePassword,
  createRefreshJti,
  hashPassword,
  hashToken,
  JwtUser,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
} from "./lib/tokens";

const REFRESH_COOKIE = "refresh_token";
const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redisClient.on("error", (err) => {
  console.error("[AuthService] Redis client error:", err);
});

function publicUser(user: { id: string; name: string; email: string; role: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

async function issueTokens(user: JwtUser, res: Response) {
  const jti = createRefreshJti();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, jti);
  const refreshTokenHash = await hashToken(refreshToken);

  // Store JTI whitelist key in Redis with 30 days expiration (matching refresh token)
  const redisKey = `auth:refresh:${user.id}:${jti}`;
  await redisClient.set(redisKey, "valid", "EX", 30 * 24 * 60 * 60);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash, refreshTokenJti: jti, refreshTokenExp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });

  setRefreshCookie(res, refreshToken);
  return { accessToken };
}

async function main() {
  // Connect to PostgreSQL with retry
  let retries = 5;
  while (retries > 0) {
    try {
      await prisma.$connect();
      console.log(`[${config.serviceName}] Connected to PostgreSQL`);
      break;
    } catch (err) {
      retries -= 1;
      console.warn(`[${config.serviceName}] Database connection failed. Retries left: ${retries}. Error:`, err);
      if (retries === 0) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  const app = express();

  app.use(cors({ origin: config.cors.origin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body ?? {};
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required" });
    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) return res.status(409).json({ error: "Email already exists" });

    const user = await prisma.user.create({ data: { name: String(name).trim(), email: normalizedEmail, passwordHash: await hashPassword(String(password)) } });
    const tokens = await issueTokens(publicUser(user), res);

    // Emit event USER_REGISTERED
    const event = {
      id: crypto.randomUUID(),
      type: "USER_REGISTERED",
      source: "AuthService",
      timestamp: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
      payload: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
    await redisClient.publish("notifications.events", JSON.stringify(event));
    console.log(`[AuthService] Emitted USER_REGISTERED event for user ${user.id}`);

    return res.status(201).json({ user: publicUser(user), accessToken: tokens.accessToken });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await comparePassword(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const tokens = await issueTokens(publicUser(user), res);
    return res.json({ user: publicUser(user), accessToken: tokens.accessToken });
  });

  app.get("/api/auth/me", async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });
    try {
      const payload = verifyAccessToken(auth.slice(7));
      return res.json({ user: payload });
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ error: "Missing refresh token" });
    try {
      const payload = verifyRefreshToken(token);

      // Verify refresh JTI whitelist in Redis
      const redisKey = `auth:refresh:${payload.id}:${payload.jti}`;
      const isValid = await redisClient.get(redisKey);
      if (!isValid) return res.status(401).json({ error: "Refresh token revoked or expired" });

      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (!user) return res.status(401).json({ error: "Refresh token revoked" });

      // Revoke old JTI immediately
      await redisClient.del(redisKey);

      const newJti = createRefreshJti();
      const accessToken = signAccessToken(publicUser(user));
      const refreshToken = signRefreshToken(publicUser(user), newJti);

      // Save new JTI whitelist
      const newRedisKey = `auth:refresh:${user.id}:${newJti}`;
      await redisClient.set(newRedisKey, "valid", "EX", 30 * 24 * 60 * 60);

      const refreshTokenHash = await hashToken(refreshToken);
      await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash, refreshTokenJti: newJti, refreshTokenExp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
      setRefreshCookie(res, refreshToken);
      return res.json({ user: publicUser(user), accessToken });
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        
        // Remove whitelist in Redis
        const redisKey = `auth:refresh:${payload.id}:${payload.jti}`;
        await redisClient.del(redisKey);

        await prisma.user.update({ where: { id: payload.id }, data: { refreshTokenHash: null, refreshTokenJti: null, refreshTokenExp: null } });
      } catch {}
    }
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth", httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite });
    return res.json({ ok: true });
  });

  app.get("/api/auth/roles/admin", async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });
    try {
      const user = verifyAccessToken(auth.slice(7));
      if (user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
      return res.json({ ok: true });
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  });

  // GET /api/users/profile
  app.get("/api/users/profile", async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });
    try {
      const payload = verifyAccessToken(auth.slice(7));
      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ user: publicUser(user) });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  });

  // PATCH /api/users/profile
  app.patch("/api/users/profile", async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });
    try {
      const payload = verifyAccessToken(auth.slice(7));
      const { name, email, password } = req.body ?? {};

      const updateData: any = {};
      if (name) updateData.name = String(name).trim();
      if (email) {
        const normalizedEmail = String(email).toLowerCase().trim();
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing && existing.id !== payload.id) return res.status(409).json({ error: "Email already taken" });
        updateData.email = normalizedEmail;
      }
      if (password) {
        updateData.passwordHash = await hashPassword(String(password));
      }

      const updatedUser = await prisma.user.update({
        where: { id: payload.id },
        data: updateData
      });

      return res.json({ user: publicUser(updatedUser) });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  });

  // POST /api/auth/forgot-password
  app.post("/api/auth/forgot-password", async (req, res, next) => {
    try {
      const { email } = req.body ?? {};
      if (!email) return res.status(400).json({ error: "Email is required" });
      const normalizedEmail = String(email).toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        console.log(`[AuthService] Password reset requested for non-existent email: ${normalizedEmail}`);
        return res.json({ message: "If your email exists in our system, a reset link has been sent." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordToken: resetToken, resetPasswordExpires }
      });

      const resetLink = `${config.cors.origin}/auth?mode=reset&token=${resetToken}`;

      // 1. Send Gmail message (with its own try/catch to avoid blocking the API flow if SMTP fails)
      try {
        await sendResetPasswordEmail(user.email, resetLink);
        console.log(`[AuthService] Password reset email successfully sent to ${user.email}`);
      } catch (mailError) {
        console.error(`[AuthService] Failed to send password reset email to ${user.email}:`, mailError);
      }

      // 2. Publish event to Redis (with its own try/catch)
      const event = {
        id: crypto.randomUUID(),
        type: "PASSWORD_RESET_REQUESTED",
        source: "AuthService",
        timestamp: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
        payload: {
          userId: user.id,
          email: user.email,
          resetToken,
          resetLink
        }
      };
      try {
        await redisClient.publish("notifications.events", JSON.stringify(event));
        console.log(`[AuthService] Emitted PASSWORD_RESET_REQUESTED event for user ${user.id}`);
      } catch (redisError) {
        console.error(`[AuthService] Failed to publish PASSWORD_RESET_REQUESTED event:`, redisError);
      }

      return res.json({ message: "If your email exists in our system, a reset link has been sent." });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/reset-password
  app.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const { token, password } = req.body ?? {};
      if (!token || !password) return res.status(400).json({ error: "Token and password are required" });

      const user = await prisma.user.findUnique({ where: { resetPasswordToken: String(token) } });
      if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
        return res.status(400).json({ error: "Invalid or expired password reset token" });
      }

      const passwordHash = await hashPassword(String(password));
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          refreshTokenHash: null,
          refreshTokenJti: null,
          refreshTokenExp: null
        }
      });

      const stream = redisClient.scanStream({ match: `auth:refresh:${user.id}:*` });
      stream.on("data", async (keys) => {
        if (keys.length > 0) {
          try {
            await redisClient.del(...keys);
          } catch (delError) {
            console.error("[AuthService] Failed to delete revoked refresh tokens from Redis:", delError);
          }
        }
      });
      stream.on("error", (err) => {
        console.error("[AuthService] Redis scan stream error:", err);
      });

      console.log(`[AuthService] Password reset successfully for user ${user.id}`);
      return res.json({ ok: true, message: "Password has been reset successfully. Please log in with your new password." });
    } catch (err) {
      next(err);
    }
  });

  // Global Express Error Handler
  app.use((err: any, _req: Request, res: Response, _next: any) => {
    console.error("[AuthService] Unhandled route error:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error", detail: err?.message || String(err) });
  });

  app.get("/health", (_req, res) => res.json({ service: config.serviceName, status: "healthy", uptime: process.uptime() }));
  app.listen(config.port, () => console.log(`🔐 ${config.serviceName} running on http://localhost:${config.port}`));
  process.on("SIGTERM", async () => {
    await redisClient.quit();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
