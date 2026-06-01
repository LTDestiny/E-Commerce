import express, { Request, Response } from "express";
import cors, { CorsOptions } from "cors";
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
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: (user as any).status || "ACTIVE",
  };
}

type AdminUserProjection = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
};

function adminUser(user: AdminUserProjection) {
  return {
    ...publicUser(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

const USER_STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["SUSPENDED", "LOCKED"],
  SUSPENDED: ["ACTIVE", "LOCKED"],
  LOCKED: ["ACTIVE"],
};

async function requireAdmin(req: Request, res: Response): Promise<JwtUser | null> {
  const gatewayRole = req.headers["x-user-role"];
  const gatewayUserId = req.headers["x-user-id"];

  if (gatewayRole === "ADMIN" && gatewayUserId) {
    return {
      id: String(gatewayUserId),
      email: String(req.headers["x-user-email"] || ""),
      name: decodeURIComponent(String(req.headers["x-user-name"] || "Admin")),
      role: "ADMIN",
    };
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return null;
  }

  try {
    const user = verifyAccessToken(auth.slice(7));
    if (user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
}

async function ensureDemoUsers() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE'`);

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@techsphere.local").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
  const adminName = process.env.ADMIN_NAME || "Admin User";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", name: adminName },
    create: {
      name: adminName,
      email: adminEmail,
      role: "ADMIN",
      passwordHash: await hashPassword(adminPassword),
    },
  });

  const demoPasswordHash = await hashPassword(process.env.DEMO_USER_PASSWORD || "Demo@123456");
  const demoUsers = [
    { id: "user-customer-jordan", name: "Jordan Smith", email: "jordan.smith@techsphere.local" },
    { id: "user-customer-sarah", name: "Sarah Connor", email: "sarah.connor@techsphere.local" },
    { id: "user-customer-arthur", name: "Arthur Morgan", email: "arthur.morgan@techsphere.local" },
    { id: "user-customer-liam", name: "Liam Neesson", email: "liam.neesson@techsphere.local" },
    { id: "user-customer-mia", name: "Mia Wallace", email: "mia.wallace@techsphere.local" },
    { id: "user-customer-olivia", name: "Olivia Bennett", email: "olivia.bennett@techsphere.local" },
    { id: "user-test-nova", name: "Nova Flow Tester", email: "nova.flow@techsphere.local" },
    { id: "user-flow-01", name: "Ava Pending", email: "ava.pending@techsphere.local" },
    { id: "user-flow-02", name: "Ben Pending", email: "ben.pending@techsphere.local" },
    { id: "user-flow-03", name: "Chloe Pending", email: "chloe.pending@techsphere.local" },
    { id: "user-flow-04", name: "Dylan Pending", email: "dylan.pending@techsphere.local" },
    { id: "user-flow-05", name: "Emma Pending", email: "emma.pending@techsphere.local" },
    { id: "user-flow-06", name: "Felix Pending", email: "felix.pending@techsphere.local" },
    { id: "user-flow-07", name: "Gia Pending", email: "gia.pending@techsphere.local" },
    { id: "user-flow-08", name: "Hugo Pending", email: "hugo.pending@techsphere.local" },
    { id: "user-flow-09", name: "Ivy Pending", email: "ivy.pending@techsphere.local" },
    { id: "user-flow-10", name: "Jack Pending", email: "jack.pending@techsphere.local" },
    { id: "user-flow-11", name: "Kira Reserved", email: "kira.reserved@techsphere.local" },
    { id: "user-flow-12", name: "Leo Processing", email: "leo.processing@techsphere.local" },
    { id: "user-flow-13", name: "Mina Paid", email: "mina.paid@techsphere.local" },
    { id: "user-flow-14", name: "Noah Confirmed", email: "noah.confirmed@techsphere.local" },
    { id: "user-flow-15", name: "Orla Scheduled", email: "orla.scheduled@techsphere.local" },
    { id: "user-flow-16", name: "Piper Shipped", email: "piper.shipped@techsphere.local" },
    { id: "user-flow-17", name: "Quinn Delivered", email: "quinn.delivered@techsphere.local" },
    { id: "user-flow-18", name: "Riley Cancelled", email: "riley.cancelled@techsphere.local" },
    { id: "user-flow-19", name: "Sage Expired", email: "sage.expired@techsphere.local" },
    { id: "user-flow-20", name: "Theo Refunded", email: "theo.refunded@techsphere.local" },
  ];

  const generatedFlowUsers = Array.from({ length: 60 }, (_, index) => {
    const flowIndex = index + 1;
    return {
      id: `user-flow-${String(flowIndex).padStart(2, "0")}`,
      name: `Flow Customer ${String(flowIndex).padStart(2, "0")}`,
      email: `flow.customer.${String(flowIndex).padStart(2, "0")}@techsphere.local`,
    };
  });
  const allDemoUsers = [...demoUsers, ...generatedFlowUsers];

  for (const user of allDemoUsers) {
    const existingById = await prisma.user.findUnique({ where: { id: user.id } });
    if (existingById) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: user.name, role: "USER" },
      });
      continue;
    }

    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "USER",
        passwordHash: demoPasswordHash,
      },
    });
  }

  console.log(`[AuthService] Ensured admin account ${adminEmail} and ${allDemoUsers.length} demo users`);
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
  await prisma.$connect();
  await ensureDemoUsers();
  const app = express();
  const allowedOrigins = new Set(config.cors.allowedOrigins);
  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  };

  app.use(cors(corsOptions));
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

  // GET /api/users - Admin customer/account list
  app.get("/api/users", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const users = await prisma.$queryRaw<AdminUserProjection[]>`
      SELECT id, name, email, role, status, "createdAt", "updatedAt"
      FROM users
      ORDER BY "createdAt" DESC
    `;

    return res.json((users as unknown as AdminUserProjection[]).map(adminUser));
  });

  // GET /api/users/:id - Admin account detail
  app.get("/api/users/:id", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const users = await prisma.$queryRaw<AdminUserProjection[]>`
      SELECT id, name, email, role, status, "createdAt", "updatedAt"
      FROM users
      WHERE id = ${req.params.id}
      LIMIT 1
    `;
    const user = users[0];

    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(adminUser(user as unknown as AdminUserProjection));
  });

  // PATCH /api/users/:id/role - Admin role management
  app.patch("/api/users/:id/role", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const role = String(req.body?.role || "").toUpperCase();
    if (!["USER", "ADMIN"].includes(role)) {
      return res.status(400).json({ error: "Role must be USER or ADMIN" });
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
    });
    const users = await prisma.$queryRaw<AdminUserProjection[]>`
      SELECT id, name, email, role, status, "createdAt", "updatedAt"
      FROM users
      WHERE id = ${req.params.id}
      LIMIT 1
    `;
    const user = users[0];

    return res.json(adminUser(user as unknown as AdminUserProjection));
  });

  // PATCH /api/users/:id/status - Admin account status control
  app.patch("/api/users/:id/status", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (admin.id === req.params.id) {
      return res.status(400).json({ error: "Admins cannot change their own account status" });
    }

    const requestedStatus = String(req.body?.status || "").toUpperCase();
    const reason = String(req.body?.reason || "").trim();
    if (!Object.keys(USER_STATUS_TRANSITIONS).includes(requestedStatus)) {
      return res.status(400).json({ error: "Invalid user account status" });
    }

    const currentRows = await prisma.$queryRaw<AdminUserProjection[]>`
      SELECT id, name, email, role, status, "createdAt", "updatedAt"
      FROM users
      WHERE id = ${req.params.id}
      LIMIT 1
    `;
    const current = currentRows[0];
    if (!current) return res.status(404).json({ error: "User not found" });

    const currentStatus = current.status || "ACTIVE";
    const allowed = USER_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(requestedStatus)) {
      return res.status(409).json({ error: `Transition ${currentStatus} -> ${requestedStatus} is not allowed` });
    }

    if (["SUSPENDED", "LOCKED"].includes(requestedStatus) && !reason) {
      return res.status(400).json({ error: "Reason is required for suspend/lock actions" });
    }

    await prisma.$executeRaw`
      UPDATE users
      SET status = ${requestedStatus}, "updatedAt" = NOW()
      WHERE id = ${req.params.id}
    `;
    const updatedRows = await prisma.$queryRaw<AdminUserProjection[]>`
      SELECT id, name, email, role, status, "createdAt", "updatedAt"
      FROM users
      WHERE id = ${req.params.id}
      LIMIT 1
    `;
    const user = updatedRows[0];

    return res.json(adminUser(user as AdminUserProjection));
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

      const resetLink = `${config.cors.primaryOrigin}/auth?mode=reset&token=${resetToken}`;

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
