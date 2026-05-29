import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { prisma } from "./lib/prisma";
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

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash, refreshTokenJti: jti, refreshTokenExp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });

  setRefreshCookie(res, refreshToken);
  return { accessToken };
}

async function main() {
  await prisma.$connect();
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
      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (!user || !user.refreshTokenHash || !user.refreshTokenJti) return res.status(401).json({ error: "Refresh token revoked" });
      const matches = await comparePassword(token, user.refreshTokenHash);
      if (!matches || user.refreshTokenJti !== payload.jti) return res.status(401).json({ error: "Refresh token revoked" });

      const newJti = createRefreshJti();
      const accessToken = signAccessToken(publicUser(user));
      const refreshToken = signRefreshToken(publicUser(user), newJti);
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

  app.get("/health", (_req, res) => res.json({ service: config.serviceName, status: "healthy", uptime: process.uptime() }));
  app.listen(config.port, () => console.log(`🔐 ${config.serviceName} running on http://localhost:${config.port}`));
  process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
}

main().catch(console.error);
