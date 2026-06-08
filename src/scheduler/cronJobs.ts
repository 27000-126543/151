import cron from "node-cron";
import { dailyReportService } from "../services/dailyReportService";
import { billingService } from "../services/billingService";
import { carbonService } from "../services/carbonService";
import { logger } from "../utils/logger";
import { User } from "../entities/User";
import { AppDataSource } from "../config/data-source";

export const startCronJobs = () => {
  cron.schedule("0 0 1 * *", async () => {
    try {
      logger.info("开始生成月度账单...");
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const result = await billingService.generateMonthlyBills(
        lastMonth.getFullYear(),
        lastMonth.getMonth() + 1
      );
      logger.info(`月度账单生成完成，共 ${result.length} 份`);
    } catch (error) {
      logger.error("生成月度账单失败:", error);
    }
  });

  cron.schedule("0 0 * * *", async () => {
    try {
      logger.info("开始检查逾期账单...");
      const result = await billingService.checkOverdueBills();
      logger.info(
        `逾期账单检查完成: 新增逾期 ${result.newOverdue.length} 份, 需限电 ${result.needLimitPower.length} 份`
      );
    } catch (error) {
      logger.error("检查逾期账单失败:", error);
    }
  });

  cron.schedule("0 0 * * *", async () => {
    try {
      logger.info("开始生成能源运营日报...");
      const regions = ["朝阳区", "海淀区", "东城区", "西城区", "丰台区"];

      for (const region of regions) {
        try {
          await dailyReportService.generateDailyReport(undefined, region);
        } catch (error) {
          logger.error(`生成 ${region} 日报失败:`, error);
        }
      }

      await dailyReportService.generateDailyReport();
      logger.info("能源运营日报生成完成");
    } catch (error) {
      logger.error("生成能源运营日报失败:", error);
    }
  });

  cron.schedule("0 1 * * *", async () => {
    try {
      logger.info("开始计算每日碳排放...");
      const userRepo = AppDataSource.getRepository(User);
      const users = await userRepo.find({ where: { isActive: true } });

      let successCount = 0;
      for (const user of users) {
        try {
          await carbonService.calculateDailyEmissions(user.id, new Date(Date.now() - 86400000));
          successCount++;
        } catch (error) {
          logger.error(`计算用户 ${user.id} 碳排放失败:`, error);
        }
      }

      logger.info(`每日碳排放计算完成，成功 ${successCount}/${users.length} 户`);
    } catch (error) {
      logger.error("计算每日碳排放失败:", error);
    }
  });

  logger.info("定时任务调度器已启动");
};
