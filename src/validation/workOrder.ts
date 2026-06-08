import Joi from "joi";
import { FaultLevel, RepairSkill } from "../entities/WorkOrder";

export const createWorkOrderSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  faultLevel: Joi.string()
    .valid(...Object.values(FaultLevel))
    .required(),
  deviceId: Joi.string().optional(),
  requiredSkill: Joi.string()
    .valid(...Object.values(RepairSkill))
    .optional(),
  region: Joi.string().optional(),
  location: Joi.string().optional(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  dueDate: Joi.date().optional(),
  remark: Joi.string().optional(),
});

export const createFromAlertSchema = Joi.object({
  alertId: Joi.string().required(),
});

export const completeWorkOrderSchema = Joi.object({
  repairContent: Joi.string().required(),
  partsReplaced: Joi.string().optional(),
  repairCost: Joi.number().positive().optional(),
  beforeImages: Joi.array().items(Joi.string()).optional(),
  afterImages: Joi.array().items(Joi.string()).optional(),
});

export const verifyWorkOrderSchema = Joi.object({
  passed: Joi.boolean().required(),
});
