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

export const authMiddleware = (...requiredRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError("未提供认证令牌", 401));
    }

    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, config.jwt.secret as string) as any;
      req.user = decoded;

      if (requiredRoles.length > 0 && !requiredRoles.includes(decoded.role) && decoded.role !== UserRole.ADMIN) {
        return next(new AppError("权限不足", 403));
      }

      next();
    } catch (error) {
      next(new AppError("认证令牌无效或已过期", 401));
    }
  };
};

export const generateToken = (user: { id: string; role: UserRole; username: string }) => {
  return (jwt as any).sign(user, config.jwt.secret as string, { expiresIn: config.jwt.expiresIn as string });
};
