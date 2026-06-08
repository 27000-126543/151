import { Request, Response, NextFunction } from "express";
import * as Joi from "joi";
import { AppError } from "./errorHandler";

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      throw new AppError(`数据验证失败: ${JSON.stringify(errors)}`, 400);
    }

    next();
  };
};
