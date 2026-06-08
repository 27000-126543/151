import Joi from "joi";
import { TradeType } from "../entities/PowerTrade";

export const createTradeSchema = Joi.object({
  tradeType: Joi.string()
    .valid(...Object.values(TradeType))
    .required(),
  quantity: Joi.number().positive().required(),
  bidPrice: Joi.number().positive().required(),
  deliveryDate: Joi.date().required(),
  region: Joi.string().optional(),
  strategy: Joi.string().optional(),
  hourlyBreakdown: Joi.array()
    .items(
      Joi.object({
        hour: Joi.number().min(0).max(23).required(),
        quantity: Joi.number().positive().required(),
        price: Joi.number().positive().required(),
      })
    )
    .optional(),
  remark: Joi.string().optional(),
});

export const submitApprovalSchema = Joi.object({
  tradeId: Joi.string().required(),
});

export const approveTradeSchema = Joi.object({
  approvalRemark: Joi.string().optional(),
});

export const rejectTradeSchema = Joi.object({
  approvalRemark: Joi.string().required(),
});

export const submitTradeSchema = Joi.object({
  tradeId: Joi.string().required(),
});

export const generateStrategySchema = Joi.object({
  deliveryDate: Joi.date().required(),
  region: Joi.string().optional(),
});
