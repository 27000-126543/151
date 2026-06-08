import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { successResponse, paginatedResponse } from "../utils/response";
import { AppError } from "../middleware/errorHandler";
import { dailyReportService } from "../services/dailyReportService";
import { createReadStream } from "fs";
import { join } from "path";

export const generateDailyReport = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reportDate, region } = req.body;
    const date = reportDate ? new Date(reportDate) : undefined;
    const result = await dailyReportService.generateDailyReport(date, region);
    successResponse(res, result, "日报生成成功");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getReports = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate, region } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await dailyReportService.getReports(
      new Date(startDate as string),
      new Date(endDate as string),
      region as string | undefined,
      page,
      pageSize
    );
    paginatedResponse(res, result.items, result.total, page, pageSize);
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getReportDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const reportId = req.params.id;
    const report = await dailyReportService.getReportDetail(reportId);
    if (!report) {
      throw new AppError("报告不存在", 404);
    }
    successResponse(res, report);
  } catch (error) {
    next(error);
  }
};

export const exportReport = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const reportId = req.params.id;
    const { format } = req.body;

    const result = await dailyReportService.exportReport(reportId, format);

    if (format === "excel" && typeof result === "object" && result.filePath) {
      const fileStream = createReadStream(result.filePath);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      fileStream.pipe(res);
      return;
    }

    successResponse(res, result, "报告导出成功");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};
