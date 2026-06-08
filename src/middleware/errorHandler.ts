import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.warn(`Operational error: ${err.message}`, { statusCode: err.statusCode, path: req.path });
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  const errMsg = err.message.toLowerCase();
  if (
    errMsg.includes("database") ||
    errMsg.includes("connection") ||
    errMsg.includes("sqlite") ||
    errMsg.includes("postgres") ||
    errMsg.includes("not established") ||
    errMsg.includes("query") ||
    errMsg.includes("repository") ||
    errMsg.includes("find") ||
    errMsg.includes("save")
  ) {
    logger.warn(`Database error: ${err.message}`, { path: req.path });
    return res.status(503).json({
      success: false,
      message: "数据库服务暂不可用，请稍后重试",
    });
  }

  logger.error(`Unexpected error: ${err.message}`, { stack: err.stack, path: req.path });
  res.status(500).json({
    success: false,
    message: "服务器内部错误",
  });
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`找不到路径 ${req.originalUrl}`, 404));
};
