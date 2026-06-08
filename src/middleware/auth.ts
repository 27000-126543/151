import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { config } from "../config/env";
import { AppError } from "./errorHandler";
import { UserRole } from "../entities/User";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    username: string;
  };
}

export const authMiddleware = (requiredRole?: UserRole) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("未提供认证令牌", 401);
    }

    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      req.user = decoded;

      if (requiredRole && decoded.role !== requiredRole && decoded.role !== UserRole.ADMIN) {
        throw new AppError("权限不足", 403);
      }

      next();
    } catch (error) {
      throw new AppError("认证令牌无效或已过期", 401);
    }
  };
};

export const generateToken = (user: { id: string; role: UserRole; username: string }) => {
  return jwt.sign(user, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
};
