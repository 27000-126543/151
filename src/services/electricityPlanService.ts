import { Repository } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { ElectricityPlan, PlanStatus } from "../entities/ElectricityPlan";
import { RecommendedPlan, StrategyType } from "../entities/RecommendedPlan";
import { ElectricityPrice, TimeSlot, PriceType } from "../entities/ElectricityPrice";
import { LoadForecast, ForecastType } from "../entities/LoadForecast";
import { Device, DeviceType } from "../entities/Device";
import { DeviceData } from "../entities/DeviceData";
import { logger } from "../utils/logger";
import { roundTo, getTimeSlot } from "../utils/helpers";
import { sendToUser } from "./notificationService";
import { NotificationType } from "../entities/Notification";

export class ElectricityPlanService {
  private planRepo: Repository<ElectricityPlan>;
  private recommendedPlanRepo: Repository<RecommendedPlan>;
  private priceRepo: Repository<ElectricityPrice>;
  private forecastRepo: Repository<LoadForecast>;
  private deviceRepo: Repository<Device>;
  private deviceDataRepo: Repository<DeviceData>;

  constructor() {
    this.planRepo = AppDataSource.getRepository(ElectricityPlan);
    this.recommendedPlanRepo = AppDataSource.getRepository(RecommendedPlan);
    this.priceRepo = AppDataSource.getRepository(ElectricityPrice);
    this.forecastRepo = AppDataSource.getRepository(LoadForecast);
    this.deviceRepo = AppDataSource.getRepository(Device);
    this.deviceDataRepo = AppDataSource.getRepository(DeviceData);
  }

  async submitPlan(userId: string, planData: any) {
    const plan = this.planRepo.create({
      ...planData,
      userId,
      status: PlanStatus.PENDING,
    });

    await this.planRepo.save(plan);
    logger.info(`用户 ${userId} 提交用电计划 ${plan.id}`);

    const recommendations = await this.generateRecommendations(plan);

    plan.status = PlanStatus.RECOMMENDED;
    plan.estimatedCost = recommendations[0]?.totalCost || 0;
    await this.planRepo.save(plan);

    sendToUser(userId, NotificationType.SYSTEM, {
      title: "用电计划已分析",
      content: "系统已为您生成最优用电方案，请查看并选择",
      planId: plan.id,
    });

    return { plan, recommendations };
  }

  async generateRecommendations(plan: ElectricityPlan) {
    const prices = await this.getDayAheadPrices(plan.planDate);
    const forecast = await this.getDayAheadForecast(plan.planDate, plan.user?.region);
    const userDevices = await this.getUserDevices(plan.userId);
    const historicalData = await this.getHistoricalData(plan.userId);

    const recommendations: RecommendedPlan[] = [];

    recommendations.push(
      await this.createRecommendation(
        plan,
        StrategyType.COST_OPTIMAL,
        prices,
        forecast,
        userDevices,
        historicalData
      )
    );

    recommendations.push(
      await this.createRecommendation(
        plan,
        StrategyType.BALANCED,
        prices,
        forecast,
        userDevices,
        historicalData
      )
    );

    recommendations.push(
      await this.createRecommendation(
        plan,
        StrategyType.ENVIRONMENTAL,
        prices,
        forecast,
        userDevices,
        historicalData
      )
    );

    return this.recommendedPlanRepo.save(recommendations);
  }

  private async createRecommendation(
    plan: ElectricityPlan,
    strategyType: StrategyType,
    prices: ElectricityPrice[],
    forecast: LoadForecast | null,
    userDevices: Device[],
    historicalData: any
  ) {
    const optimizedSlots = [];
    let totalCost = 0;
    let totalSaving = 0;
    let carbonReduction = 0;

    const priceByHour = this.getPriceByHour(prices);
    const forecastByHour = forecast?.hourlyForecast || Array(24).fill(0);

    for (const slot of plan.timeSlots) {
      const originalCost = slot.demand * priceByHour[slot.hour];
      let optimizedDemand = slot.demand;
      let shiftedTo: number | undefined;

      if (slot.flexible) {
        const shiftResult = this.optimizeSlot(
          slot,
          strategyType,
          priceByHour,
          forecastByHour,
          userDevices,
          plan.preferences
        );
        optimizedDemand = shiftResult.demand;
        shiftedTo = shiftResult.shiftedTo;
      }

      const optimizedCost = optimizedDemand * priceByHour[slot.hour];
      const saving = originalCost - optimizedCost;

      totalCost += optimizedCost;
      totalSaving += saving;

      if (strategyType === StrategyType.ENVIRONMENTAL) {
        carbonReduction += this.calculateCarbonReduction(slot.demand, optimizedDemand, slot.hour);
      }

      optimizedSlots.push({
        hour: slot.hour,
        originalDemand: slot.demand,
        optimizedDemand: roundTo(optimizedDemand, 2),
        shiftedTo,
        cost: roundTo(optimizedCost, 2),
        saving: roundTo(saving, 2),
      });
    }

    const originalTotalCost = plan.timeSlots.reduce(
      (sum, slot) => sum + slot.demand * priceByHour[slot.hour],
      0
    );

    return this.recommendedPlanRepo.create({
      electricityPlanId: plan.id,
      strategyType,
      optimizedSlots,
      totalCost: roundTo(totalCost, 2),
      estimatedSaving: roundTo(totalSaving, 2),
      savingRate: roundTo((totalSaving / originalTotalCost) * 100, 2),
      carbonReduction: roundTo(carbonReduction, 4),
      recommendations: this.generateRecommendationText(strategyType, totalSaving, carbonReduction),
      analysisData: {
        prices,
        forecast: forecastByHour,
        historicalData,
        originalTotalCost: roundTo(originalTotalCost, 2),
      },
    });
  }

  private optimizeSlot(
    slot: { hour: number; demand: number; flexible: boolean },
    strategyType: StrategyType,
    priceByHour: number[],
    forecastByHour: number[],
    userDevices: Device[],
    preferences?: any
  ) {
    let bestHour = slot.hour;
    let bestScore = Infinity;

    const avoidHours = preferences?.avoidHours || [];
    const searchWindow = this.getSearchWindow(slot.hour, strategyType);

    for (const hour of searchWindow) {
      if (avoidHours.includes(hour)) continue;

      const price = priceByHour[hour];
      const forecast = forecastByHour[hour];
      const renewableRatio = this.getRenewableRatioAtHour(hour, userDevices);

      let score: number;
      switch (strategyType) {
        case StrategyType.COST_OPTIMAL:
          score = price * 100;
          break;
        case StrategyType.BALANCED:
          score = price * 50 + (forecast / 1000) * 30 + (1 - renewableRatio) * 20;
          break;
        case StrategyType.ENVIRONMENTAL:
          score = (1 - renewableRatio) * 100 + price * 20;
          break;
        default:
          score = price;
      }

      if (score < bestScore) {
        bestScore = score;
        bestHour = hour;
      }
    }

    return {
      demand: bestHour === slot.hour ? slot.demand : slot.demand,
      shiftedTo: bestHour !== slot.hour ? bestHour : undefined,
    };
  }

  private getSearchWindow(currentHour: number, strategyType: StrategyType) {
    const window = strategyType === StrategyType.COST_OPTIMAL ? 6 : 3;
    const hours: number[] = [];
    for (let i = -window; i <= window; i++) {
      const hour = (currentHour + i + 24) % 24;
      hours.push(hour);
    }
    return hours;
  }

  private getPriceByHour(prices: ElectricityPrice[]): number[] {
    const priceByHour = Array(24).fill(0);
    for (let hour = 0; hour < 24; hour++) {
      const timeSlot = getTimeSlot(new Date(2000, 0, 1, hour));
      const price = prices.find((p) => p.timeSlot === timeSlot);
      priceByHour[hour] = price?.price || 0.5;
    }
    return priceByHour;
  }

  private getRenewableRatioAtHour(hour: number, devices: Device[]) {
    if (hour >= 6 && hour <= 18) {
      const pvCount = devices.filter((d) => d.deviceType === DeviceType.PV).length;
      return Math.min(0.8, 0.3 + pvCount * 0.1);
    }
    return 0.1;
  }

  private calculateCarbonReduction(originalDemand: number, optimizedDemand: number, hour: number) {
    const emissionFactorDay = 0.8;
    const emissionFactorNight = 0.5;
    const factor = hour >= 6 && hour <= 22 ? emissionFactorDay : emissionFactorNight;
    return (originalDemand - optimizedDemand) * factor;
  }

  private generateRecommendationText(strategyType: StrategyType, saving: number, carbonReduction: number) {
    switch (strategyType) {
      case StrategyType.COST_OPTIMAL:
        return `本方案以成本最优为目标，预计可节省电费 ${roundTo(saving, 2)} 元。建议将弹性用电负荷转移至电价低谷时段。`;
      case StrategyType.BALANCED:
        return `本方案综合考虑成本、可靠性和环保因素，在保证用电可靠性的同时，实现成本节约和碳排放减少。`;
      case StrategyType.ENVIRONMENTAL:
        return `本方案以环保优先为目标，预计可减少碳排放 ${roundTo(carbonReduction, 4)} 吨。建议优先使用可再生能源发电时段。`;
      default:
        return "";
    }
  }

  private async getDayAheadPrices(date: Date) {
    return this.priceRepo.find({
      where: {
        priceType: PriceType.GRID,
        isActive: true,
      },
    });
  }

  private async getDayAheadForecast(date: Date, region?: string) {
    return this.forecastRepo.findOne({
      where: {
        forecastDate: date,
        forecastType: ForecastType.DAY_AHEAD,
        region: region || "",
      },
    });
  }

  private async getUserDevices(userId: string) {
    return this.deviceRepo.find({
      where: { userId },
    });
  }

  private async getHistoricalData(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const data = await this.deviceDataRepo
      .createQueryBuilder("dd")
      .innerJoinAndSelect("dd.device", "device")
      .where("device.userId = :userId", { userId })
      .andWhere("dd.timestamp >= :thirtyDaysAgo", { thirtyDaysAgo })
      .getMany();

    return {
      dataPoints: data.length,
      avgConsumption: data.reduce((sum, d) => sum + (d.powerInput || 0), 0) / Math.max(1, data.length),
      avgGeneration: data.reduce((sum, d) => sum + (d.powerOutput || 0), 0) / Math.max(1, data.length),
    };
  }

  async getPlansByUser(userId: string, page: number = 1, pageSize: number = 10) {
    const [plans, total] = await this.planRepo.findAndCount({
      where: { userId },
      relations: ["recommendedPlans"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { plans, total };
  }

  async getPlanById(planId: string, userId: string) {
    return this.planRepo.findOne({
      where: { id: planId, userId },
      relations: ["recommendedPlans"],
    });
  }

  async selectRecommendedPlan(planId: string, recommendedPlanId: string, userId: string) {
    const plan = await this.planRepo.findOne({
      where: { id: planId, userId },
      relations: ["recommendedPlans"],
    });

    if (!plan) {
      throw new Error("用电计划不存在");
    }

    const recommendedPlan = plan.recommendedPlans.find((p) => p.id === recommendedPlanId);
    if (!recommendedPlan) {
      throw new Error("推荐方案不存在");
    }

    await this.recommendedPlanRepo.update(
      { electricityPlanId: planId },
      { isSelected: false }
    );

    recommendedPlan.isSelected = true;
    await this.recommendedPlanRepo.save(recommendedPlan);

    plan.status = PlanStatus.APPROVED;
    plan.estimatedCost = recommendedPlan.totalCost;
    await this.planRepo.save(plan);

    sendToUser(userId, NotificationType.SYSTEM, {
      title: "用电方案已确认",
      content: `您已选择${this.getStrategyName(recommendedPlan.strategyType)}方案，预计成本 ${recommendedPlan.totalCost} 元`,
      planId,
    });

    return { plan, selectedPlan: recommendedPlan };
  }

  private getStrategyName(strategyType: StrategyType) {
    const names = {
      [StrategyType.COST_OPTIMAL]: "成本最优",
      [StrategyType.BALANCED]: "综合平衡",
      [StrategyType.ENVIRONMENTAL]: "环保优先",
    };
    return names[strategyType];
  }
}

export const electricityPlanService = new ElectricityPlanService();
