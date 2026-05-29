import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config";

export type JwtUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function signAccessToken(user: JwtUser) {
  const options: SignOptions = { expiresIn: config.jwt.accessExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(user, config.jwt.accessSecret, options);
}

export function signRefreshToken(user: JwtUser, jti: string) {
  const options: SignOptions = { expiresIn: config.jwt.refreshExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign({ ...user, jti }, config.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, config.jwt.accessSecret) as JwtUser;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, config.jwt.refreshSecret) as JwtUser & { jti: string };
}

export function createRefreshJti() {
  return crypto.randomUUID();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function hashToken(token: string) {
  return bcrypt.hash(token, 10);
}
