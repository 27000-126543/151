import Joi from "joi";

export const generateReportSchema = Joi.object({
  reportDate: Joi.date().optional(),
  region: Joi.string().optional(),
});

export const getReportsSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  region: Joi.string().optional(),
  page: Joi.number().min(1).optional(),
  pageSize: Joi.number().min(1).max(100).optional(),
});

export const exportReportSchema = Joi.object({
  format: Joi.string().valid("excel", "pdf").default("excel"),
});
