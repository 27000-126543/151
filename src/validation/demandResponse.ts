import * as Joi from "joi";

export const createDemandResponseSchema = Joi.object({
  name: Joi.string().required(),
  responseType: Joi.string()
    .valid("peak_shaving", "emergency", "price_response", "capacity")
    .required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  targetLoadReduction: Joi.number().positive().required(),
  incentivePrice: Joi.number().positive().required(),
  region: Joi.string().optional(),
  description: Joi.string().optional(),
  eligibilityCriteria: Joi.object({
    minLoad: Joi.number().positive().optional(),
    userTypes: Joi.array().items(Joi.string()).optional(),
    regions: Joi.array().items(Joi.string()).optional(),
  }).optional(),
});

export const acceptTaskSchema = Joi.object({});

export const rejectTaskSchema = Joi.object({
  rejectionReason: Joi.string().required(),
});

export const completeTaskSchema = Joi.object({
  actualLoadReduction: Joi.number().required(),
  remark: Joi.string().optional(),
});

export const settleDemandResponseSchema = Joi.object({
  settledBy: Joi.string().required(),
  remark: Joi.string().optional(),
});
