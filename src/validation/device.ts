import * as Joi from "joi";

export const reportDataSchema = Joi.object({
  deviceCode: Joi.string().required(),
  timestamp: Joi.date().optional(),
  powerOutput: Joi.number().min(0).optional(),
  powerInput: Joi.number().min(0).optional(),
  stateOfCharge: Joi.number().min(0).max(100).optional(),
  voltage: Joi.number().optional(),
  current: Joi.number().optional(),
  temperature: Joi.number().optional(),
  frequency: Joi.number().optional(),
  powerFactor: Joi.number().optional(),
  totalEnergyGenerated: Joi.number().min(0).optional(),
  totalEnergyConsumed: Joi.number().min(0).optional(),
  loadRate: Joi.number().min(0).max(100).optional(),
  rawData: Joi.object().optional(),
});

export const createDispatchCommandSchema = Joi.object({
  deviceId: Joi.string().uuid().required(),
  commandType: Joi.string()
    .valid(
      "grid_connect",
      "grid_disconnect",
      "charge",
      "discharge",
      "power_output_adjust",
      "load_shedding",
      "start",
      "stop",
      "maintenance"
    )
    .required(),
  targetValue: Joi.number().optional(),
  scheduledTime: Joi.date().optional(),
  reason: Joi.string().optional(),
  additionalParams: Joi.object().optional(),
});

export const ackAlertSchema = Joi.object({
  acknowledgedBy: Joi.string().required(),
});

export const resolveAlertSchema = Joi.object({
  resolvedBy: Joi.string().required(),
  resolution: Joi.string().required(),
});
