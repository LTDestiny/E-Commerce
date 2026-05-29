import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { prisma } from "./prisma";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function signToken(user: AuthUser) {
  const options: SignOptions = { expiresIn: config.jwt.expiresIn as SignOptions["expiresIn"] };
  return jwt.sign(user, config.jwt.secret, options);
}

export function sanitizeUser(user: AuthUser) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function getBearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const payload = jwt.verify(token, config.jwt.secret) as AuthUser;
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return res.status(401).json({ error: "User not found" });
    (req as Request & { user?: AuthUser }).user = sanitizeUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
