import { Repository, Between } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { DailyReport } from "../entities/DailyReport";
import { DeviceData } from "../entities/DeviceData";
import { Device, DeviceStatus, DeviceType } from "../entities/Device";
import { DemandResponseTask, TaskStatus } from "../entities/DemandResponseTask";
import { WorkOrder, WorkOrderStatus } from "../entities/WorkOrder";
import { Alert, AlertLevel, AlertStatus } from "../entities/Alert";
import { PowerTrade, TradeStatus } from "../entities/PowerTrade";
import { CarbonEmission } from "../entities/CarbonEmission";
import { ElectricityPrice } from "../entities/ElectricityPrice";
import { UserRole } from "../entities/User";
import { logger } from "../utils/logger";
import {
  roundTo,
  startOfDay,
  endOfDay,
  startOfYesterday,
  endOfYesterday,
  formatDate,
} from "../utils/helpers";
import { sendToRole } from "./notificationService";
import { NotificationType, NotificationSeverity } from "../entities/Notification";
import * as ExcelJS from "exceljs";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export class DailyReportService {
  private reportRepo: Repository<DailyReport>;
  private deviceDataRepo: Repository<DeviceData>;
  private deviceRepo: Repository<Device>;
  private drTaskRepo: Repository<DemandResponseTask>;
  private workOrderRepo: Repository<WorkOrder>;
  private alertRepo: Repository<Alert>;
  private tradeRepo: Repository<PowerTrade>;
  private emissionRepo: Repository<CarbonEmission>;
  private priceRepo: Repository<ElectricityPrice>;

  constructor() {
    this.reportRepo = AppDataSource.getRepository(DailyReport);
    this.deviceDataRepo = AppDataSource.getRepository(DeviceData);
    this.deviceRepo = AppDataSource.getRepository(Device);
    this.drTaskRepo = AppDataSource.getRepository(DemandResponseTask);
    this.workOrderRepo = AppDataSource.getRepository(WorkOrder);
    this.alertRepo = AppDataSource.getRepository(Alert);
    this.tradeRepo = AppDataSource.getRepository(PowerTrade);
    this.emissionRepo = AppDataSource.getRepository(CarbonEmission);
    this.priceRepo = AppDataSource.getRepository(ElectricityPrice);
  }

  async generateDailyReport(reportDate?: Date, region?: string) {
    const date = reportDate || startOfYesterday();
    const start = startOfDay(date);
    const end = endOfDay(date);

    const existingReport = await this.reportRepo.findOne({
      where: { reportDate: start, region: region || "" },
    });

    if (existingReport) {
      return existingReport;
    }

    const [
      loadData,
      generationData,
      drData,
      deviceStatus,
      workOrderData,
      alertData,
      tradeData,
      carbonData,
      priceData,
    ] = await Promise.all([
      this.calculateLoadMetrics(start, end, region),
      this.calculateGenerationMetrics(start, end, region),
      this.calculateDemandResponseMetrics(start, end, region),
      this.calculateDeviceStatusMetrics(region),
      this.calculateWorkOrderMetrics(start, end, region),
      this.calculateAlertMetrics(start, end, region),
      this.calculateTradingMetrics(start, end, region),
      this.calculateCarbonMetrics(start, end, region),
      this.getHourlyPrices(start, region),
    ]);

    const report = this.reportRepo.create({
      reportDate: start,
      region: region || "",
      ...loadData,
      ...generationData,
      ...drData,
      ...deviceStatus,
      ...workOrderData,
      ...alertData,
      ...tradeData,
      ...carbonData,
      hourlyPriceData: priceData,
      summary: this.generateSummary(loadData, generationData, drData, deviceStatus),
      recommendations: this.generateRecommendations(loadData, generationData, drData, alertData),
    });

    await this.reportRepo.save(report);

    sendToRole(UserRole.OPERATOR, NotificationType.REPORT, {
      title: "能源运营日报已生成",
      content: `${formatDate(start)} 能源运营日报已生成，请查阅`,
      severity: NotificationSeverity.INFO,
      report,
    });

    logger.info(`生成能源运营日报: ${formatDate(start)}`);
    return report;
  }

  private async calculateLoadMetrics(start: Date, end: Date, region?: string) {
    const hourlyLoad = Array(24).fill(0);
    let peakLoad = 0;
    let valleyLoad = Infinity;
    let peakLoadTime: Date | null = null;
    let valleyLoadTime: Date | null = null;
    let totalConsumption = 0;

    const whereConditions: any = { timestamp: Between(start, end) };
    if (region) whereConditions.region = region;

    const data = await this.deviceDataRepo.find({ where: whereConditions });

    for (const record of data) {
      const hour = record.timestamp.getHours();
      const load = record.powerInput || 0;
      hourlyLoad[hour] += load;
      totalConsumption += load;
    }

    for (let hour = 0; hour < 24; hour++) {
      const load = roundTo(hourlyLoad[hour], 4);
      if (load > peakLoad) {
        peakLoad = load;
        peakLoadTime = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour, 0, 0);
      }
      if (load < valleyLoad && load > 0) {
        valleyLoad = load;
        valleyLoadTime = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour, 0, 0);
      }
    }

    const nonZeroHours = hourlyLoad.filter((l) => l > 0).length;
    const averageLoad = nonZeroHours > 0 ? roundTo(totalConsumption / nonZeroHours, 4) : 0;

    return {
      peakLoad: roundTo(peakLoad, 4),
      peakLoadTime: peakLoadTime || undefined,
      valleyLoad: valleyLoad === Infinity ? 0 : roundTo(valleyLoad, 4),
      valleyLoadTime: valleyLoadTime || undefined,
      averageLoad,
      totalConsumption: roundTo(totalConsumption, 4),
      hourlyLoadData: hourlyLoad.map((l) => roundTo(l, 4)),
    };
  }

  private async calculateGenerationMetrics(start: Date, end: Date, region?: string) {
    let pvGeneration = 0;
    let windGeneration = 0;
    let storageCharge = 0;
    let storageDischarge = 0;
    let gridImport = 0;
    let gridExport = 0;

    const whereConditions: any = { timestamp: Between(start, end) };
    if (region) whereConditions.region = region;

    const data = await this.deviceDataRepo
      .createQueryBuilder("dd")
      .leftJoinAndSelect("dd.device", "device")
      .where("dd.timestamp BETWEEN :start AND :end", { start, end })
      .andWhere(region ? "dd.region = :region" : "1=1", { region })
      .getMany();

    for (const record of data) {
      const deviceType = record.device?.deviceType;
      const powerOutput = record.powerOutput || 0;
      const powerInput = record.powerInput || 0;
      const stateOfCharge = record.stateOfCharge || 0;

      if (deviceType === DeviceType.PV) {
        pvGeneration += powerOutput;
      } else if (deviceType === DeviceType.STORAGE) {
        if (powerInput > powerOutput) {
          storageCharge += powerInput - powerOutput;
        } else {
          storageDischarge += powerOutput - powerInput;
        }
      }

      if (powerInput > 0 && deviceType !== DeviceType.PV) {
        gridImport += powerInput;
      }
      if (powerOutput > 0 && (deviceType === DeviceType.PV || deviceType === DeviceType.STORAGE)) {
        gridExport += powerOutput;
      }
    }

    const renewableGeneration = pvGeneration + windGeneration;
    const totalGeneration = renewableGeneration + storageDischarge;
    const totalConsumption = gridImport + storageCharge;
    const renewableRatio = totalConsumption > 0
      ? roundTo((renewableGeneration / totalConsumption) * 100, 4)
      : 0;

    return {
      totalGeneration: roundTo(totalGeneration, 4),
      renewableGeneration: roundTo(renewableGeneration, 4),
      renewableRatio,
      pvGeneration: roundTo(pvGeneration, 4),
      windGeneration: roundTo(windGeneration, 4),
      storageCharge: roundTo(storageCharge, 4),
      storageDischarge: roundTo(storageDischarge, 4),
      gridImport: roundTo(gridImport, 4),
      gridExport: roundTo(gridExport, 4),
    };
  }

  private async calculateDemandResponseMetrics(start: Date, end: Date, region?: string) {
    const whereConditions: any = { createdAt: Between(start, end) };
    if (region) whereConditions.region = region;

    const tasks = await this.drTaskRepo.find({ where: whereConditions });

    const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED);
    const participationCount = new Set(tasks.map((t) => t.userId)).size;
    const totalIncentive = completedTasks.reduce((sum, t) => sum + (t.incentiveAmount || 0), 0);
    const totalLoadReduction = completedTasks.reduce((sum, t) => sum + (t.actualLoadReduction || 0), 0);

    const eligibleUsers = await this.deviceRepo
      .createQueryBuilder("device")
      .select("DISTINCT device.userId")
      .where("device.isActive = true")
      .andWhere("device.maxInterruptibleLoad > 0")
      .andWhere(region ? "device.region = :region" : "1=1", { region })
      .getCount();

    const participationRate = eligibleUsers > 0
      ? roundTo((participationCount / eligibleUsers) * 100, 4)
      : 0;

    return {
      demandResponseCount: tasks.length,
      demandResponseLoadReduction: roundTo(totalLoadReduction, 4),
      participationCount,
      participationRate,
      totalIncentive: roundTo(totalIncentive, 2),
    };
  }

  private async calculateDeviceStatusMetrics(region?: string) {
    const whereConditions: any = {};
    if (region) whereConditions.region = region;

    const [totalDevices, normalDevices, warningDevices, faultDevices, offlineDevices] =
      await Promise.all([
        this.deviceRepo.count({ where: whereConditions }),
        this.deviceRepo.count({ where: { ...whereConditions, status: DeviceStatus.NORMAL } }),
        this.deviceRepo.count({ where: { ...whereConditions, status: DeviceStatus.WARNING } }),
        this.deviceRepo.count({ where: { ...whereConditions, status: DeviceStatus.FAULT } }),
        this.deviceRepo.count({ where: { ...whereConditions, status: DeviceStatus.OFFLINE } }),
      ]);

    const deviceFaultRate = totalDevices > 0
      ? roundTo(((faultDevices + offlineDevices) / totalDevices) * 100, 4)
      : 0;

    return {
      totalDevices,
      normalDevices,
      warningDevices,
      faultDevices,
      offlineDevices,
      deviceFaultRate,
    };
  }

  private async calculateWorkOrderMetrics(start: Date, end: Date, region?: string) {
    const whereConditions: any = { createdAt: Between(start, end) };
    if (region) whereConditions.region = region;

    const newWorkOrders = await this.workOrderRepo.count({ where: whereConditions });

    const completedConditions: any = { completedAt: Between(start, end) };
    if (region) completedConditions.region = region;

    const completedWorkOrders = await this.workOrderRepo.count({
      where: completedConditions,
    });

    return { newWorkOrders, completedWorkOrders };
  }

  private async calculateAlertMetrics(start: Date, end: Date, region?: string) {
    const whereConditions: any = { createdAt: Between(start, end) };
    if (region) whereConditions.region = region;

    const activeAlerts = await this.alertRepo.count({
      where: [
        { ...whereConditions, status: AlertStatus.PENDING },
        { ...whereConditions, status: AlertStatus.ACKNOWLEDGED },
        { ...whereConditions, status: AlertStatus.PROCESSING },
      ],
    });

    const criticalAlerts = await this.alertRepo.count({
      where: { ...whereConditions, level: AlertLevel.CRITICAL },
    });

    return { activeAlerts, criticalAlerts };
  }

  private async calculateTradingMetrics(start: Date, end: Date, region?: string) {
    const whereConditions: any = { createdAt: Between(start, end) };
    if (region) whereConditions.region = region;

    const trades = await this.tradeRepo.find({
      where: { ...whereConditions, status: TradeStatus.FULLY_FILLED },
    });

    const totalTradingVolume = trades.reduce((sum, t) => sum + (t.filledQuantity || 0), 0);
    const totalTradingAmount = trades.reduce((sum, t) => sum + (t.settlementAmount || 0), 0);

    return {
      totalTradingVolume: roundTo(totalTradingVolume, 4),
      totalTradingAmount: roundTo(totalTradingAmount, 2),
    };
  }

  private async calculateCarbonMetrics(start: Date, end: Date, region?: string) {
    const whereConditions: any = { emissionDate: Between(start, end) };
    if (region) whereConditions.region = region;

    const emissions = await this.emissionRepo.find({ where: whereConditions });
    const totalCarbonEmission = emissions.reduce((sum, e) => sum + e.emissionAmount, 0);

    const pvGeneration = await this.deviceDataRepo
      .createQueryBuilder("dd")
      .leftJoinAndSelect("dd.device", "device")
      .where("dd.timestamp BETWEEN :start AND :end", { start, end })
      .andWhere("device.deviceType = 'pv'")
      .andWhere(region ? "dd.region = :region" : "1=1", { region })
      .getMany();

    const totalPV = pvGeneration.reduce((sum, d) => sum + (d.powerOutput || 0), 0);
    const carbonReduction = totalPV * 0.00098;

    return {
      totalCarbonEmission: roundTo(totalCarbonEmission, 4),
      carbonReduction: roundTo(carbonReduction, 4),
    };
  }

  private async getHourlyPrices(start: Date, region?: string) {
    const prices = await this.priceRepo.find({
      where: { isActive: true, region: region || undefined as any },
    });

    const hourlyPrices = Array(24).fill(0);
    for (let hour = 0; hour < 24; hour++) {
      const slot = this.hourToTimeSlot(hour);
      const price = prices.find((p) => p.timeSlot === slot);
      hourlyPrices[hour] = price?.price || 0.5;
    }

    return hourlyPrices;
  }

  private hourToTimeSlot(hour: number): string {
    if (hour >= 0 && hour < 6) return "valley";
    if (hour >= 6 && hour < 10) return "flat";
    if (hour >= 10 && hour < 14) return "peak";
    if (hour >= 14 && hour < 18) return "flat";
    if (hour >= 18 && hour < 22) return "peak";
    return "valley";
  }

  private generateSummary(load: any, generation: any, dr: any, devices: any) {
    const parts = [];
    parts.push(`今日最大负荷 ${load.peakLoad} kW，出现在 ${load.peakLoadTime?.toLocaleTimeString()}`);
    parts.push(`最小负荷 ${load.valleyLoad} kW，出现在 ${load.valleyLoadTime?.toLocaleTimeString()}`);
    parts.push(`可再生能源占比 ${generation.renewableRatio}%`);
    parts.push(`需求响应参与率 ${dr.participationRate}%，减少负荷 ${dr.demandResponseLoadReduction} kWh`);
    parts.push(`设备故障率 ${devices.deviceFaultRate}%`);
    return parts.join("；");
  }

  private generateRecommendations(load: any, generation: any, dr: any, alerts: any) {
    const recommendations = [];

    const peakValleyRatio = load.valleyLoad > 0 ? load.peakLoad / load.valleyLoad : 0;
    if (peakValleyRatio > 2.5) {
      recommendations.push("峰谷差较大，建议加强需求响应管理，引导用户错峰用电");
    }

    if (generation.renewableRatio < 20) {
      recommendations.push("可再生能源占比偏低，建议加大光伏、风电等清洁能源接入");
    }

    if (dr.participationRate < 30) {
      recommendations.push("需求响应参与率较低，建议优化激励政策，提高用户参与积极性");
    }

    if (alerts.criticalAlerts > 5) {
      recommendations.push(`今日发生 ${alerts.criticalAlerts} 起严重告警，建议加强设备巡检和维护`);
    }

    if (recommendations.length === 0) {
      recommendations.push("今日运营状况良好，继续保持");
    }

    return recommendations.join("；");
  }

  async getReports(startDate: Date, endDate: Date, region?: string, page: number = 1, pageSize: number = 20) {
    const where: any = {
      reportDate: Between(startOfDay(startDate), endOfDay(endDate)),
    };
    if (region) where.region = region;

    const [items, total] = await this.reportRepo.findAndCount({
      where,
      order: { reportDate: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }

  async getReportDetail(reportId: string) {
    return this.reportRepo.findOne({ where: { id: reportId } });
  }

  async exportReport(reportId: string, format: "excel" | "pdf" = "excel") {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) {
      throw new Error("报告不存在");
    }

    if (format === "excel") {
      return this.generateExcelReport(report);
    }

    return report;
  }

  private async generateExcelReport(report: DailyReport) {
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet("运营总览");
    summarySheet.columns = [
      { header: "指标", key: "metric", width: 30 },
      { header: "数值", key: "value", width: 20 },
      { header: "单位", key: "unit", width: 10 },
    ];

    summarySheet.addRows([
      { metric: "报告日期", value: formatDate(report.reportDate), unit: "" },
      { metric: "区域", value: report.region || "全市", unit: "" },
      { metric: "最大负荷", value: report.peakLoad, unit: "kW" },
      { metric: "最小负荷", value: report.valleyLoad, unit: "kW" },
      { metric: "平均负荷", value: report.averageLoad, unit: "kW" },
      { metric: "总用电量", value: report.totalConsumption, unit: "kWh" },
      { metric: "可再生能源占比", value: report.renewableRatio, unit: "%" },
      { metric: "光伏发电量", value: report.pvGeneration, unit: "kWh" },
      { metric: "风电发电量", value: report.windGeneration, unit: "kWh" },
      { metric: "储能充电量", value: report.storageCharge, unit: "kWh" },
      { metric: "储能放电量", value: report.storageDischarge, unit: "kWh" },
      { metric: "电网购电量", value: report.gridImport, unit: "kWh" },
      { metric: "电网售电量", value: report.gridExport, unit: "kWh" },
      { metric: "需求响应次数", value: report.demandResponseCount, unit: "次" },
      { metric: "需求响应削峰量", value: report.demandResponseLoadReduction, unit: "kWh" },
      { metric: "参与用户数", value: report.participationCount, unit: "户" },
      { metric: "参与率", value: report.participationRate, unit: "%" },
      { metric: "激励总额", value: report.totalIncentive, unit: "元" },
      { metric: "设备总数", value: report.totalDevices, unit: "台" },
      { metric: "正常设备", value: report.normalDevices, unit: "台" },
      { metric: "告警设备", value: report.warningDevices, unit: "台" },
      { metric: "故障设备", value: report.faultDevices, unit: "台" },
      { metric: "离线设备", value: report.offlineDevices, unit: "台" },
      { metric: "设备故障率", value: report.deviceFaultRate, unit: "%" },
      { metric: "新增工单", value: report.newWorkOrders, unit: "单" },
      { metric: "完成工单", value: report.completedWorkOrders, unit: "单" },
      { metric: "活跃告警", value: report.activeAlerts, unit: "条" },
      { metric: "严重告警", value: report.criticalAlerts, unit: "条" },
      { metric: "总交易量", value: report.totalTradingVolume, unit: "kWh" },
      { metric: "总交易金额", value: report.totalTradingAmount, unit: "元" },
      { metric: "总碳排放量", value: report.totalCarbonEmission, unit: "tCO₂e" },
      { metric: "碳减排量", value: report.carbonReduction, unit: "tCO₂e" },
    ]);

    const hourlySheet = workbook.addWorksheet("24小时数据");
    hourlySheet.columns = [
      { header: "时段", key: "hour", width: 10 },
      { header: "负荷(kW)", key: "load", width: 15 },
      { header: "电价(元/kWh)", key: "price", width: 15 },
    ];

    for (let hour = 0; hour < 24; hour++) {
      hourlySheet.addRow({
        hour: `${hour}:00-${hour + 1}:00`,
        load: report.hourlyLoadData?.[hour] || 0,
        price: report.hourlyPriceData?.[hour] || 0,
      });
    }

    const summaryTextSheet = workbook.addWorksheet("摘要与建议");
    summaryTextSheet.columns = [
      { header: "类型", key: "type", width: 15 },
      { header: "内容", key: "content", width: 80 },
    ];

    summaryTextSheet.addRows([
      { type: "运营摘要", content: report.summary },
      { type: "改进建议", content: report.recommendations },
    ]);

    const exportsDir = join(process.cwd(), "exports");
    if (!existsSync(exportsDir)) {
      mkdirSync(exportsDir, { recursive: true });
    }

    const fileName = `能源运营日报_${formatDate(report.reportDate, "YYYYMMDD")}.xlsx`;
    const filePath = join(exportsDir, fileName);

    await workbook.xlsx.writeFile(filePath);
    return { fileName, filePath, format: "excel" };
  }
}

export const dailyReportService = new DailyReportService();
