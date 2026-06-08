import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { successResponse, paginatedResponse } from "../utils/response";
import { AppError } from "../middleware/errorHandler";
import { carbonService } from "../services/carbonService";
import { CreditType } from "../entities/CarbonCredit";
import { createReadStream } from "fs";
import { join } from "path";

export const calculateDailyEmissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { date } = req.body;
    const result = await carbonService.calculateDailyEmissions(userId, new Date(date));
    successResponse(res, result, "碳排放计算完成");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getEmissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;
    const result = await carbonService.getEmissions(
      userId,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    successResponse(res, result);
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getCarbonCredits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const type = req.query.type as CreditType | undefined;

    const result = await carbonService.getCarbonCredits(userId, type, page, pageSize);
    res.json({
      success: true,
      message: "查询成功",
      data: {
        items: result.items,
        balance: result.balance,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const generateCarbonReport = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate, format } = req.body;

    const result = await carbonService.generateCarbonReport(
      userId,
      new Date(startDate),
      new Date(endDate),
      format
    ) as any;

    if (format === "excel" && result.filePath) {
      const filePath = join(process.cwd(), result.filePath);
      const fileStream = createReadStream(filePath);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      fileStream.pipe(res);
      return;
    }

    successResponse(res, result, "碳报告生成成功");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const transferCredits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const fromUserId = req.user!.id;
    const { toUserId, amount } = req.body;
    const result = await carbonService.transferCredits(fromUserId, toUserId, amount);
    successResponse(res, result, "碳积分转让成功");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getMonthSummary = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { year, month } = req.query;
    const result = await carbonService.calculateMonthSummary(
      userId,
      parseInt(year as string),
      parseInt(month as string)
    );
    successResponse(res, result);
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};
