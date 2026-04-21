import { Request, Response, NextFunction } from "express";

declare module "express-serve-static-core" {
  interface Request {
    userId?: number;
    userRole?: string;
    username?: string;
  }
}

const sessions = new Map<string, { userId: number; role: string; username: string; createdAt: Date }>();

export function createSession(userId: number, role: string, username: string): string {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessions.set(token, { userId, role, username, createdAt: new Date() });
  return token;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

export function getSession(token: string) {
  return sessions.get(token);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  req.userId = session.userId;
  req.userRole = session.role;
  req.username = session.username;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };
}
