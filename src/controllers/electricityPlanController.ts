import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { successResponse, paginatedResponse } from "../utils/response";
import { AppError } from "../middleware/errorHandler";
import { electricityPlanService } from "../services/electricityPlanService";

export const submitPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const result = await electricityPlanService.submitPlan(userId, req.body);
    successResponse(res, result, "用电计划提交成功，正在生成推荐方案", 201);
  } catch (error) {
    next(error);
  }
};

export const getMyPlans = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const result = await electricityPlanService.getPlansByUser(userId, page, pageSize);
    paginatedResponse(res, result.plans, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const getPlanDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const planId = req.params.id;

    const plan = await electricityPlanService.getPlanById(planId, userId);
    if (!plan) {
      throw new AppError("用电计划不存在", 404);
    }

    successResponse(res, plan);
  } catch (error) {
    next(error);
  }
};

export const selectRecommendedPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const planId = req.params.id;
    const { recommendedPlanId } = req.body;

    const result = await electricityPlanService.selectRecommendedPlan(
      planId,
      recommendedPlanId,
      userId
    );

    successResponse(res, result, "已选择推荐方案");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};
