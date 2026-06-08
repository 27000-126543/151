import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { successResponse, paginatedResponse } from "../utils/response";
import { AppError } from "../middleware/errorHandler";
import { demandResponseService } from "../services/demandResponseService";
import { ResponseStatus } from "../entities/DemandResponse";
import { TaskStatus } from "../entities/DemandResponseTask";
import { UserRole } from "../entities/User";

export const createDemandResponse = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const operatorId = req.user!.id;
    const dr = await demandResponseService.createDemandResponse(req.body, operatorId);
    successResponse(res, dr, "需求响应事件创建成功", 201);
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const publishDemandResponse = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const drId = req.params.id;
    const operatorId = req.user!.id;
    const result = await demandResponseService.publishDemandResponse(drId, operatorId);
    successResponse(res, result, "需求响应已发布");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getDemandResponses = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const status = req.query.status as ResponseStatus;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await demandResponseService.getDemandResponses(status, page, pageSize);
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const getDemandResponseDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const drId = req.params.id;
    const result = await demandResponseService.getDemandResponseDetail(drId);
    if (!result) {
      return next(new AppError("需求响应事件不存在", 404));
    }
    successResponse(res, result);
  } catch (error: any) {
    next(error);
  }
};

export const settleDemandResponse = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const drId = req.params.id;
    const { settledBy, remark } = req.body;
    const result = await demandResponseService.settleDemandResponse(drId, settledBy, remark);
    successResponse(res, result, "需求响应已结算");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getMyTasks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const status = req.query.status as TaskStatus;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await demandResponseService.getMyTasks(userId, status, page, pageSize);
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const getTaskDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.OPERATOR
      ? undefined
      : req.user!.id;

    const task = await demandResponseService.getTaskDetail(taskId, userId);
    if (!task) {
      throw new AppError("任务不存在", 404);
    }
    successResponse(res, task);
  } catch (error: any) {
    next(new AppError(error.message, 404));
  }
};

export const acceptTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;
    const task = await demandResponseService.acceptTask(taskId, userId);
    successResponse(res, task, "已接受任务");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const rejectTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;
    const { rejectionReason } = req.body;
    const task = await demandResponseService.rejectTask(taskId, userId, rejectionReason);
    successResponse(res, task, "已拒绝任务");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const startTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;
    const task = await demandResponseService.startTask(taskId, userId);
    successResponse(res, task, "任务已开始");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const completeTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;
    const { actualLoadReduction, remark } = req.body;
    const task = await demandResponseService.completeTask(
      taskId,
      userId,
      actualLoadReduction,
      remark
    );
    successResponse(res, task, "任务已完成");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};
