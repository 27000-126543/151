import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { successResponse, paginatedResponse } from "../utils/response";
import { AppError } from "../middleware/errorHandler";
import { billingService } from "../services/billingService";
import { BillStatus } from "../entities/Bill";
import { LimitOrderStatus } from "../entities/LimitPowerOrder";
import { UserRole } from "../entities/User";

export const generateMonthlyBills = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { year, month } = req.body;
    const result = await billingService.generateMonthlyBills(year, month);
    successResponse(res, { count: result.length, bills: result }, `已生成 ${result.length} 份账单`);
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const issueBill = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const billId = req.params.id;
    const result = await billingService.issueBill(billId);
    successResponse(res, result, "账单已发布");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const payBill = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const billId = req.params.id;
    const { amount } = req.body;
    const result = await billingService.payBill(billId, amount);
    successResponse(res, result, "支付成功");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const checkOverdueBills = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await billingService.checkOverdueBills();
    successResponse(res, result, "逾期账单检查完成");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const issueLimitPowerOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const issuerId = req.user!.id;
    const { collectorId } = req.body;
    const result = await billingService.issueLimitPowerOrder(orderId, issuerId, collectorId);
    successResponse(res, result, "限电指令已发布");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const restorePower = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const result = await billingService.restorePower(orderId);
    successResponse(res, result, "供电已恢复");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getBills = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as BillStatus | undefined;
    const userId = req.user!.role === UserRole.ADMIN ? undefined : req.user!.id;

    const result = await billingService.getBills(userId, status, page, pageSize);
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const getMyBills = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as BillStatus | undefined;

    const result = await billingService.getBills(userId, status, page, pageSize);
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const getBillDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const billId = req.params.id;
    const userId = req.user!.role === UserRole.ADMIN ? undefined : req.user!.id;
    const bill = await billingService.getBillDetail(billId, userId);
    if (!bill) {
      throw new AppError("账单不存在", 404);
    }
    successResponse(res, bill);
  } catch (error) {
    next(error);
  }
};

export const getLimitOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as LimitOrderStatus | undefined;
    const userId = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.COLLECTOR
      ? undefined
      : req.user!.id;

    const result = await billingService.getLimitOrders(userId, status, page, pageSize);
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};
