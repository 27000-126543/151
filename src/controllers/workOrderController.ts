import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { successResponse, paginatedResponse } from "../utils/response";
import { AppError } from "../middleware/errorHandler";
import { workOrderService } from "../services/workOrderService";
import { WorkOrderStatus, FaultLevel, RepairSkill } from "../entities/WorkOrder";
import { TeamStatus } from "../entities/RepairTeam";

export const createWorkOrderFromAlert = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { alertId } = req.body;
    const result = await workOrderService.createWorkOrderFromAlert(alertId);
    successResponse(res, result, "工单创建成功", 201);
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const createManualWorkOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const operatorId = req.user!.id;
    const result = await workOrderService.createManualWorkOrder(req.body, operatorId);
    successResponse(res, result, "工单创建成功", 201);
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const dispatchWorkOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const result = await workOrderService.dispatchWorkOrder(orderId);
    successResponse(res, result, "工单已派单");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const startWorkOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const result = await workOrderService.startWorkOrder(orderId);
    successResponse(res, result, "开始抢修");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const completeWorkOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const { repairContent, partsReplaced, repairCost, beforeImages, afterImages } = req.body;
    const result = await workOrderService.completeWorkOrder(
      orderId,
      repairContent,
      partsReplaced,
      repairCost,
      beforeImages,
      afterImages
    );
    successResponse(res, result, "工单已完成");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const verifyWorkOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const verifiedBy = req.user!.id;
    const { passed } = req.body;
    const result = await workOrderService.verifyWorkOrder(orderId, verifiedBy, passed);
    successResponse(res, result, passed ? "验收通过" : "验收未通过，需要重新修复");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const closeWorkOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const closedBy = req.user!.id;
    const result = await workOrderService.closeWorkOrder(orderId, closedBy);
    successResponse(res, result, "工单已关闭");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getWorkOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as WorkOrderStatus | undefined;
    const faultLevel = req.query.faultLevel as FaultLevel | undefined;

    const result = await workOrderService.getWorkOrders(status, faultLevel, page, pageSize);
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const getWorkOrderDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const order = await workOrderService.getWorkOrderDetail(orderId);
    if (!order) {
      throw new AppError("工单不存在", 404);
    }
    successResponse(res, order);
  } catch (error) {
    next(error);
  }
};

export const getRepairTeams = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as TeamStatus | undefined;
    const skill = req.query.skill as RepairSkill | undefined;

    const result = await workOrderService.getRepairTeams(status, skill, page, pageSize);
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};
