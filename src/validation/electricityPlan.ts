import * as Joi from "joi";

export const submitPlanSchema = Joi.object({
  planDate: Joi.date().required(),
  totalDemand: Joi.number().positive().required(),
  timeSlots: Joi.array()
    .items(
      Joi.object({
        hour: Joi.number().integer().min(0).max(23).required(),
        demand: Joi.number().min(0).required(),
        flexible: Joi.boolean().default(true),
      })
    )
    .length(24)
    .required(),
  preferences: Joi.object({
    maxCost: Joi.number().positive().optional(),
    priority: Joi.string().valid("cost", "reliability", "environmental").optional(),
    avoidHours: Joi.array().items(Joi.number().integer().min(0).max(23)).optional(),
  }).optional(),
  remark: Joi.string().optional(),
});

export const selectPlanSchema = Joi.object({
  recommendedPlanId: Joi.string().uuid().required(),
});
