import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export function protectRoute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.headers["x-user-id"];
  const userEmail = req.headers["x-user-email"];
  const userRole = req.headers["x-user-role"];
  const userName = req.headers["x-user-name"];

  if (!userId) {
    res.status(401).json({ error: "Access Denied: Unauthenticated request" });
    return;
  }

  req.user = {
    id: String(userId),
    email: String(userEmail || ""),
    role: String(userRole || "USER"),
    name: (() => {
      try {
        return decodeURIComponent(String(userName || ""));
      } catch {
        return String(userName || "");
      }
    })()
  };

  next();
}

export function hasRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: "Forbidden: Insufficient permissions" });
      return;
    }
    next();
  };
}
