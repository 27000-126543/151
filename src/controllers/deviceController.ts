import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { successResponse, paginatedResponse } from "../utils/response";
import { AppError } from "../middleware/errorHandler";
import { deviceService } from "../services/deviceService";
import { CommandType, CommandStatus } from "../entities/DispatchCommand";
import { AlertStatus } from "../entities/Alert";
import { UserRole } from "../entities/User";

export const reportDeviceData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceCode, ...data } = req.body;
    const result = await deviceService.reportDeviceData(deviceCode, data);
    successResponse(res, result, "数据上报成功");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getMyDevices = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const devices = await deviceService.getDevicesByUser(userId);
    successResponse(res, devices);
  } catch (error) {
    next(error);
  }
};

export const getDeviceDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.OPERATOR
      ? undefined
      : req.user!.id;

    const device = await deviceService.getDeviceById(deviceId, userId);
    if (!device) {
      throw new AppError("设备不存在", 404);
    }

    successResponse(res, device);
  } catch (error: any) {
    next(new AppError(error.message, 404));
  }
};

export const getDeviceHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = req.params.id;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const data = await deviceService.getDeviceHistory(deviceId, startDate, endDate);
    successResponse(res, { data, startDate, endDate });
  } catch (error) {
    next(error);
  }
};

export const createDispatchCommand = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceId, commandType, targetValue, scheduledTime, reason, additionalParams } = req.body;
    const command = await deviceService.createDispatchCommand(
      deviceId,
      commandType as CommandType,
      targetValue,
      reason,
      scheduledTime ? new Date(scheduledTime) : undefined,
      additionalParams
    );
    successResponse(res, command, "调度指令已创建", 201);
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const executeCommand = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const commandId = req.params.id;
    const command = await deviceService.executeCommand(commandId);
    successResponse(res, command, "调度指令已执行");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const getDispatchCommands = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = req.query.deviceId as string;
    const status = req.query.status as CommandStatus;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await deviceService.getDispatchCommands(deviceId, status, page, pageSize);
    paginatedResponse(res, result.commands, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const getAlerts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = req.query.deviceId as string;
    const status = req.query.status as AlertStatus;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await deviceService.getAlerts(deviceId, status, page, pageSize);
    paginatedResponse(res, result.alerts, result.total, page, pageSize);
  } catch (error) {
    next(error);
  }
};

export const acknowledgeAlert = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const alertId = req.params.id;
    const { acknowledgedBy } = req.body;
    const alert = await deviceService.acknowledgeAlert(alertId, acknowledgedBy);
    successResponse(res, alert, "告警已确认");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const resolveAlert = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const alertId = req.params.id;
    const { resolvedBy, resolution } = req.body;
    const alert = await deviceService.resolveAlert(alertId, resolvedBy, resolution);
    successResponse(res, alert, "告警已解决");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};

export const updateDeviceRisk = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = req.params.id;
    const device = await deviceService.updateDeviceRiskLevel(deviceId);
    if (!device) {
      throw new AppError("设备不存在", 404);
    }
    successResponse(res, device, "设备风险等级已更新");
  } catch (error: any) {
    next(new AppError(error.message, 400));
  }
};
