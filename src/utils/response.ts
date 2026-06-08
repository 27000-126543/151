import { Response } from "express";

export const successResponse = (
  res: Response,
  data: any = null,
  message: string = "操作成功",
  statusCode: number = 200
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const paginatedResponse = (
  res: Response,
  data: any[],
  total: number,
  page: number,
  pageSize: number,
  message: string = "查询成功"
) => {
  res.status(200).json({
    success: true,
    message,
    data: {
      items: data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
};
