import { Repository, Between } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { CarbonEmission, EnergySource, EmissionScope } from "../entities/CarbonEmission";
import { CarbonCredit, CreditType, CreditStatus } from "../entities/CarbonCredit";
import { User } from "../entities/User";
import { DeviceData } from "../entities/DeviceData";
import { Device, DeviceType } from "../entities/Device";
import { logger } from "../utils/logger";
import { roundTo, startOfDay, endOfDay, startOfMonth, endOfMonth, formatDate } from "../utils/helpers";
import { sendToUser } from "./notificationService";
import { NotificationType } from "../entities/Notification";
import * as ExcelJS from "exceljs";

const EMISSION_FACTORS: Record<EnergySource, number> = {
  [EnergySource.COAL]: 0.98,
  [EnergySource.NATURAL_GAS]: 0.55,
  [EnergySource.OIL]: 0.78,
  [EnergySource.NUCLEAR]: 0.01,
  [EnergySource.HYDRO]: 0.01,
  [EnergySource.WIND]: 0.01,
  [EnergySource.SOLAR]: 0.01,
  [EnergySource.BIOMASS]: 0.3,
  [EnergySource.GEOTHERMAL]: 0.02,
};

const GRID_ENERGY_MIX: Record<EnergySource, number> = {
  [EnergySource.COAL]: 0.55,
  [EnergySource.NATURAL_GAS]: 0.15,
  [EnergySource.OIL]: 0.05,
  [EnergySource.NUCLEAR]: 0.05,
  [EnergySource.HYDRO]: 0.1,
  [EnergySource.WIND]: 0.05,
  [EnergySource.SOLAR]: 0.03,
  [EnergySource.BIOMASS]: 0.01,
  [EnergySource.GEOTHERMAL]: 0.01,
};

export class CarbonService {
  private emissionRepo: Repository<CarbonEmission>;
  private creditRepo: Repository<CarbonCredit>;
  private userRepo: Repository<User>;
  private deviceDataRepo: Repository<DeviceData>;
  private deviceRepo: Repository<Device>;

  constructor() {
    this.emissionRepo = AppDataSource.getRepository(CarbonEmission);
    this.creditRepo = AppDataSource.getRepository(CarbonCredit);
    this.userRepo = AppDataSource.getRepository(User);
    this.deviceDataRepo = AppDataSource.getRepository(DeviceData);
    this.deviceRepo = AppDataSource.getRepository(Device);
  }

  async calculateDailyEmissions(userId: string, date: Date) {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ["devices"] });
    if (!user) {
      throw new Error("用户不存在");
    }

    const start = startOfDay(date);
    const end = endOfDay(date);

    const userDeviceIds = user.devices.map((d) => d.id);

    const pvDevices = user.devices.filter((d) => d.deviceType === DeviceType.PV);
    const storageDevices = user.devices.filter((d) => d.deviceType === DeviceType.STORAGE);

    const pvGeneration = await this.calculateDeviceTotal(pvDevices.map((d) => d.id), start, end, "powerOutput");
    const consumption = await this.calculateDeviceTotal(userDeviceIds, start, end, "powerInput");

    const netConsumption = Math.max(0, consumption - pvGeneration * 0.8);

    const emissions: CarbonEmission[] = [];

    for (const [source, ratio] of Object.entries(GRID_ENERGY_MIX)) {
      if (ratio <= 0) continue;

      const energyConsumption = netConsumption * ratio;
      const emissionFactor = EMISSION_FACTORS[source as EnergySource];
      const emissionAmount = energyConsumption * emissionFactor;

      if (emissionAmount <= 0) continue;

      const emission = this.emissionRepo.create({
        userId,
        energySource: source as EnergySource,
        scope: EmissionScope.SCOPE2,
        emissionDate: date,
        energyConsumption: roundTo(energyConsumption, 4),
        emissionFactor,
        emissionAmount: roundTo(emissionAmount, 4),
        region: user.region,
        description: `电网购电 - ${source}`,
        calculationData: {
          totalConsumption: roundTo(consumption, 4),
          pvGeneration: roundTo(pvGeneration, 4),
          netConsumption: roundTo(netConsumption, 4),
          ratio,
        },
      });

      emissions.push(emission);
    }

    await this.emissionRepo.save(emissions);

    const totalEmission = emissions.reduce((sum, e) => sum + e.emissionAmount, 0);

    if (pvGeneration > 100) {
      await this.issueCarbonCredits(userId, pvGeneration * 0.0005, date, "光伏发电减排");
    }

    return {
      date,
      totalConsumption: roundTo(consumption, 4),
      pvGeneration: roundTo(pvGeneration, 4),
      netConsumption: roundTo(netConsumption, 4),
      totalEmission: roundTo(totalEmission, 4),
      emissions,
    };
  }

  private async calculateDeviceTotal(
    deviceIds: string[],
    start: Date,
    end: Date,
    field: "powerInput" | "powerOutput"
  ): Promise<number> {
    if (deviceIds.length === 0) return 0;

    const data = await this.deviceDataRepo
      .createQueryBuilder("dd")
      .where("dd.deviceId IN (:...deviceIds)", { deviceIds })
      .andWhere("dd.timestamp BETWEEN :start AND :end", { start, end })
      .getMany();

    return data.reduce((sum, d) => sum + (d[field] || 0), 0);
  }

  async issueCarbonCredits(userId: string, amount: number, date: Date, description: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;

    const existingCredit = await this.creditRepo.findOne({
      where: { userId, type: CreditType.EARNED, description },
    });

    if (existingCredit) return existingCredit;

    const balanceBefore = user.carbonCredit || 0;
    const balanceAfter = roundTo(balanceBefore + amount, 4);

    const credit = this.creditRepo.create({
      userId,
      type: CreditType.EARNED,
      status: CreditStatus.AVAILABLE,
      amount: roundTo(amount, 4),
      balanceBefore: roundTo(balanceBefore, 4),
      balanceAfter,
      validFrom: date,
      validTo: new Date(date.getFullYear() + 1, date.getMonth(), date.getDate()),
      projectName: "光伏发电碳减排",
      description,
    });

    await this.creditRepo.save(credit);

    user.carbonCredit = balanceAfter;
    await this.userRepo.save(user);

    sendToUser(userId, NotificationType.CARBON, {
      title: "碳积分到账",
      content: `您获得碳积分 ${roundTo(amount, 4)} 吨CO₂e，来自${description}`,
      credit,
    });

    return credit;
  }

  async getEmissions(userId: string, startDate: Date, endDate: Date) {
    const emissions = await this.emissionRepo.find({
      where: {
        userId,
        emissionDate: Between(startOfDay(startDate), endOfDay(endDate)),
      },
      order: { emissionDate: "ASC", energySource: "ASC" },
    });

    const dailySummary = this.aggregateEmissionsByDay(emissions);
    const sourceSummary = this.aggregateEmissionsBySource(emissions);
    const total = emissions.reduce((sum, e) => sum + e.emissionAmount, 0);

    return {
      startDate,
      endDate,
      totalEmission: roundTo(total, 4),
      dailySummary,
      sourceSummary,
      emissions,
    };
  }

  private aggregateEmissionsByDay(emissions: CarbonEmission[]) {
    const map = new Map<string, number>();

    for (const e of emissions) {
      const date = formatDate(e.emissionDate, "YYYY-MM-DD");
      map.set(date, (map.get(date) || 0) + e.emissionAmount);
    }

    return Array.from(map.entries()).map(([date, value]) => ({
      date,
      emission: roundTo(value, 4),
    }));
  }

  private aggregateEmissionsBySource(emissions: CarbonEmission[]) {
    const map = new Map<EnergySource, number>();

    for (const e of emissions) {
      map.set(e.energySource, (map.get(e.energySource) || 0) + e.emissionAmount);
    }

    return Array.from(map.entries()).map(([source, value]) => ({
      source,
      emission: roundTo(value, 4),
      percentage: roundTo((value / emissions.reduce((s, e) => s + e.emissionAmount, 0)) * 100, 2),
    }));
  }

  async getCarbonCredits(userId: string, type?: CreditType, page: number = 1, pageSize: number = 20) {
    const where: any = { userId };
    if (type) where.type = type;

    const [items, total] = await this.creditRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const balance = items[0]?.balanceAfter || 0;

    return { items, total, balance };
  }

  async generateCarbonReport(userId: string, startDate: Date, endDate: Date, format: "excel" | "pdf" = "excel") {
    const data = await this.getEmissions(userId, startDate, endDate);
    const credits = await this.getCarbonCredits(userId);

    if (format === "excel") {
      return this.generateExcelReport(userId, startDate, endDate, data, credits);
    }

    return {
      userId,
      reportPeriod: `${formatDate(startDate)} - ${formatDate(endDate)}`,
      ...data,
      credits,
      generatedAt: new Date(),
    };
  }

  private async generateExcelReport(
    userId: string,
    startDate: Date,
    endDate: Date,
    data: any,
    credits: any
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet("排放汇总");
    summarySheet.columns = [
      { header: "项目", key: "item", width: 30 },
      { header: "数值", key: "value", width: 20 },
      { header: "单位", key: "unit", width: 10 },
    ];

    summarySheet.addRows([
      { item: "报告周期", value: `${formatDate(startDate)} - ${formatDate(endDate)}`, unit: "" },
      { item: "用户", value: user?.realName || "", unit: "" },
      { item: "总耗电量", value: data.netConsumption, unit: "kWh" },
      { item: "光伏发电量", value: data.pvGeneration, unit: "kWh" },
      { item: "总碳排放量", value: data.totalEmission, unit: "tCO₂e" },
      { item: "碳积分余额", value: credits.balance, unit: "tCO₂e" },
    ]);

    const dailySheet = workbook.addWorksheet("每日排放");
    dailySheet.columns = [
      { header: "日期", key: "date", width: 15 },
      { header: "排放量(tCO₂e)", key: "emission", width: 20 },
    ];

    for (const day of data.dailySummary) {
      dailySheet.addRow(day);
    }

    const sourceSheet = workbook.addWorksheet("能源来源分布");
    sourceSheet.columns = [
      { header: "能源类型", key: "source", width: 15 },
      { header: "排放量(tCO₂e)", key: "emission", width: 20 },
      { header: "占比(%)", key: "percentage", width: 15 },
    ];

    for (const src of data.sourceSummary) {
      sourceSheet.addRow(src);
    }

    const creditsSheet = workbook.addWorksheet("碳积分记录");
    creditsSheet.columns = [
      { header: "日期", key: "createdAt", width: 20 },
      { header: "类型", key: "type", width: 15 },
      { header: "数量(tCO₂e)", key: "amount", width: 20 },
      { header: "描述", key: "description", width: 30 },
    ];

    for (const credit of credits.items) {
      creditsSheet.addRow({
        createdAt: formatDate(credit.createdAt),
        type: credit.type,
        amount: credit.amount,
        description: credit.description,
      });
    }

    const fileName = `碳排报告_${formatDate(startDate, "YYYYMMDD")}_${formatDate(endDate, "YYYYMMDD")}.xlsx`;
    const filePath = `exports/${fileName}`;

    await workbook.xlsx.writeFile(filePath);
    return { fileName, filePath, format: "excel" };
  }

  async transferCredits(fromUserId: string, toUserId: string, amount: number) {
    const fromUser = await this.userRepo.findOne({ where: { id: fromUserId } });
    const toUser = await this.userRepo.findOne({ where: { id: toUserId } });

    if (!fromUser || !toUser) {
      throw new Error("用户不存在");
    }

    if ((fromUser.carbonCredit || 0) < amount) {
      throw new Error("碳积分余额不足");
    }

    const fromCredit = this.creditRepo.create({
      userId: fromUserId,
      type: CreditType.SOLD,
      status: CreditStatus.USED,
      amount: roundTo(amount, 4),
      balanceBefore: roundTo(fromUser.carbonCredit || 0, 4),
      balanceAfter: roundTo((fromUser.carbonCredit || 0) - amount, 4),
      description: `向 ${toUser.realName} 转让碳积分`,
      relatedTransactionId: `TRANSFER_${Date.now()}`,
    });

    const toCredit = this.creditRepo.create({
      userId: toUserId,
      type: CreditType.PURCHASED,
      status: CreditStatus.AVAILABLE,
      amount: roundTo(amount, 4),
      balanceBefore: roundTo(toUser.carbonCredit || 0, 4),
      balanceAfter: roundTo((toUser.carbonCredit || 0) + amount, 4),
      description: `从 ${fromUser.realName} 获得碳积分`,
      relatedTransactionId: `TRANSFER_${Date.now()}`,
    });

    await this.creditRepo.save([fromCredit, toCredit]);

    fromUser.carbonCredit = fromCredit.balanceAfter;
    toUser.carbonCredit = toCredit.balanceAfter;
    await this.userRepo.save([fromUser, toUser]);

    return { fromCredit, toCredit };
  }

  async calculateMonthSummary(userId: string, year: number, month: number) {
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(start);

    const data = await this.getEmissions(userId, start, end);

    return {
      month: `${year}-${month}`,
      totalEmission: data.totalEmission,
      avgDailyEmission: roundTo(data.totalEmission / Math.max(1, data.dailySummary.length), 4),
      maxDailyEmission: Math.max(...data.dailySummary.map((d: any) => d.emission), 0),
      minDailyEmission: Math.min(...data.dailySummary.map((d: any) => d.emission), 0),
      primarySource: data.sourceSummary[0]?.source,
      data,
    };
  }
}

export const carbonService = new CarbonService();
