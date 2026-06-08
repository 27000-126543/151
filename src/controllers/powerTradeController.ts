import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { successResponse, paginatedResponse } from "../utils/response";
import { AppError } from "../middleware/errorHandler";
import { powerTradeService } from "../services/powerTradeService";
import { TradeStatus, TradeType } from "../entities/PowerTrade";

export const generateTradingStrategy = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deliveryDate, region } = req.body;
    const result = await powerTradeService.generateTradingStrategy(new Date(deliveryDate), region);
    successResponse(res, result, "交易策略生成成功");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const createTrade = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const traderId = req.user!.id;
    const result = await powerTradeService.createTrade(req.body, traderId);
    successResponse(res, result, "交易创建成功", 201);
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const submitForApproval = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const traderId = req.user!.id;
    const { tradeId } = req.body;
    const result = await powerTradeService.submitForApproval(tradeId, traderId);
    successResponse(res, result, "已提交审批");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const approveTrade = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const approverId = req.user!.id;
    const tradeId = req.params.id;
    const { approvalRemark } = req.body;
    const result = await powerTradeService.approveTrade(tradeId, approverId, approvalRemark);
    successResponse(res, result, "审批通过");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const rejectTrade = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const approverId = req.user!.id;
    const tradeId = req.params.id;
    const { approvalRemark } = req.body;
    const result = await powerTradeService.rejectTrade(tradeId, approverId, approvalRemark);
    successResponse(res, result, "已驳回");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const submitTrade = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const traderId = req.user!.id;
    const tradeId = req.params.id;
    const result = await powerTradeService.submitTrade(tradeId, traderId);
    successResponse(res, result, "交易已提交");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const settleTrade = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const settledBy = req.user!.id;
    const tradeId = req.params.id;
    const result = await powerTradeService.settleTrade(tradeId, settledBy);
    successResponse(res, result, "交易已结算");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getTrades = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as TradeStatus | undefined;
    const tradeType = req.query.tradeType as TradeType | undefined;

    const result = await powerTradeService.getTrades(status, tradeType, page, pageSize);
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const getMyTrades = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const traderId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as TradeStatus | undefined;

    const result = await powerTradeService.getMyTrades(traderId, status, page, pageSize);
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const getTradeDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const tradeId = req.params.id;
    const trade = await powerTradeService.getTradeDetail(tradeId);
    if (!trade) {
      throw new AppError("交易不存在", 404);
    }
    successResponse(res, trade);
  } catch (error) {
    next(error);
  }
};
