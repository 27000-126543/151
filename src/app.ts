import "reflect-metadata";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import http from "http";
import { AppDataSource } from "./config/data-source";
import { config } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";
import { initWebSocket } from "./services/notificationService";
import { startCronJobs } from "./scheduler/cronJobs";

import electricityPlanRoutes from "./routes/electricityPlanRoutes";
import deviceRoutes from "./routes/deviceRoutes";
import demandResponseRoutes from "./routes/demandResponseRoutes";
import powerTradeRoutes from "./routes/powerTradeRoutes";
import workOrderRoutes from "./routes/workOrderRoutes";
import billingRoutes from "./routes/billingRoutes";
import carbonRoutes from "./routes/carbonRoutes";
import dailyReportRoutes from "./routes/dailyReportRoutes";

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("/api/electricity-plans", electricityPlanRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/demand-response", demandResponseRoutes);
app.use("/api/power-trades", powerTradeRoutes);
app.use("/api/work-orders", workOrderRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/carbon", carbonRoutes);
app.use("/api/daily-reports", dailyReportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port || 3000;

AppDataSource.initialize()
  .then(() => {
    logger.info("数据库连接成功");

    initWebSocket(server);

    startCronJobs();

    server.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
      logger.info(`健康检查: http://localhost:${PORT}/health`);
    });
  })
  .catch((error) => {
    logger.error("数据库连接失败:", error);
    logger.info("将在无数据库模式下启动服务，部分接口将返回错误");

    server.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}（无数据库模式）`);
      logger.info(`健康检查: http://localhost:${PORT}/health`);
    });
  });

process.on("unhandledRejection", (error: Error) => {
  logger.error("未处理的Promise拒绝:", error);
});

process.on("uncaughtException", (error: Error) => {
  logger.error("未捕获的异常:", error);
  process.exit(1);
});
