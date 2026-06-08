import Joi from "joi";
import { CreditType } from "../entities/CarbonCredit";

export const calculateEmissionsSchema = Joi.object({
  date: Joi.date().required(),
});

export const getEmissionsSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
});

export const generateReportSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  format: Joi.string().valid("excel", "pdf").default("excel"),
});

export const transferCreditsSchema = Joi.object({
  toUserId: Joi.string().required(),
  amount: Joi.number().positive().required(),
});

export const getCreditsSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(CreditType))
    .optional(),
  page: Joi.number().min(1).optional(),
  pageSize: Joi.number().min(1).max(100).optional(),
});

export const getMonthSummarySchema = Joi.object({
  year: Joi.number().min(2020).max(2100).required(),
  month: Joi.number().min(1).max(12).required(),
});
