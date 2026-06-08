import Joi from "joi";
import { BillStatus } from "../entities/Bill";
import { LimitOrderStatus } from "../entities/LimitPowerOrder";

export const generateBillsSchema = Joi.object({
  year: Joi.number().min(2020).max(2100).required(),
  month: Joi.number().min(1).max(12).required(),
});

export const payBillSchema = Joi.object({
  amount: Joi.number().positive().required(),
});

export const issueBillSchema = Joi.object({
  billId: Joi.string().required(),
});

export const issueLimitOrderSchema = Joi.object({
  collectorId: Joi.string().required(),
});

export const generateBillsQuerySchema = Joi.object({
  year: Joi.number().min(2020).max(2100).required(),
  month: Joi.number().min(1).max(12).required(),
});

export const getBillsQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(BillStatus))
    .optional(),
  page: Joi.number().min(1).optional(),
  pageSize: Joi.number().min(1).max(100).optional(),
});

export const getLimitOrdersQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(LimitOrderStatus))
    .optional(),
  page: Joi.number().min(1).optional(),
  pageSize: Joi.number().min(1).max(100).optional(),
});
