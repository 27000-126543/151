import { Repository } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { PowerTrade, TradeType, TradeStatus } from "../entities/PowerTrade";
import { LoadForecast, ForecastType } from "../entities/LoadForecast";
import { ElectricityPrice, PriceType } from "../entities/ElectricityPrice";
import { UserRole } from "../entities/User";
import { logger } from "../utils/logger";
import { generateOrderNo, roundTo, addDays, startOfDay } from "../utils/helpers";
import { sendToRole, sendToUser } from "./notificationService";
import { NotificationType, NotificationSeverity } from "../entities/Notification";

export class PowerTradeService {
  private tradeRepo: Repository<PowerTrade>;
  private forecastRepo: Repository<LoadForecast>;
  private priceRepo: Repository<ElectricityPrice>;

  constructor() {
    this.tradeRepo = AppDataSource.getRepository(PowerTrade);
    this.forecastRepo = AppDataSource.getRepository(LoadForecast);
    this.priceRepo = AppDataSource.getRepository(ElectricityPrice);
  }

  async generateTradingStrategy(deliveryDate: Date, region?: string) {
    const forecast = await this.forecastRepo.findOne({
      where: {
        forecastDate: deliveryDate,
        forecastType: ForecastType.DAY_AHEAD,
        region: region || "",
      },
    });

    if (!forecast) {
      throw new Error("无可用的负荷预测数据");
    }

    const prices = await this.priceRepo.find({
      where: { priceType: PriceType.BUY, isActive: true },
    });

    const sellPrices = await this.priceRepo.find({
      where: { priceType: PriceType.SELL, isActive: true },
    });

    const strategy = this.analyzeTradingOpportunity(forecast, prices, sellPrices);

    return {
      deliveryDate,
      forecast: forecast.hourlyForecast,
      totalForecast: forecast.totalForecast,
      strategy,
      recommendedTrades: this.generateRecommendedTrades(deliveryDate, strategy, forecast),
    };
  }

  private analyzeTradingOpportunity(
    forecast: LoadForecast,
    buyPrices: ElectricityPrice[],
    sellPrices: ElectricityPrice[]
  ) {
    const hourlyAnalysis = [];
    let totalDeficit = 0;
    let totalSurplus = 0;

    for (let hour = 0; hour < 24; hour++) {
      const forecastLoad = forecast.hourlyForecast[hour] || 0;
      const buyPrice = buyPrices.find((p) => this.hourToTimeSlot(hour) === p.timeSlot)?.price || 0.5;
      const sellPrice = sellPrices.find((p) => this.hourToTimeSlot(hour) === p.timeSlot)?.price || 0.3;

      const avgLoad = forecast.totalForecast / 24;
      const deviation = forecastLoad - avgLoad;
      const deviationRate = deviation / avgLoad;

      let action: "buy" | "sell" | "hold";
      let quantity = 0;

      if (deviationRate > 0.2) {
        action = "buy";
        quantity = Math.abs(deviation) * 0.8;
        totalDeficit += quantity;
      } else if (deviationRate < -0.2) {
        action = "sell";
        quantity = Math.abs(deviation) * 0.8;
        totalSurplus += quantity;
      } else {
        action = "hold";
      }

      hourlyAnalysis.push({
        hour,
        forecastLoad: roundTo(forecastLoad, 2),
        buyPrice,
        sellPrice,
        deviation: roundTo(deviation, 2),
        deviationRate: roundTo(deviationRate * 100, 2),
        action,
        quantity: roundTo(quantity, 2),
        estimatedAmount: roundTo(quantity * (action === "buy" ? buyPrice : sellPrice), 2),
      });
    }

    return {
      hourlyAnalysis,
      totalDeficit: roundTo(totalDeficit, 2),
      totalSurplus: roundTo(totalSurplus, 2),
      avgBuyPrice: roundTo(buyPrices.reduce((s, p) => s + p.price, 0) / buyPrices.length, 4),
      avgSellPrice: roundTo(sellPrices.reduce((s, p) => s + p.price, 0) / sellPrices.length, 4),
      recommendation: totalDeficit > totalSurplus
        ? "预计存在供电缺口，建议购入电力"
        : totalSurplus > totalDeficit
        ? "预计存在电力盈余，建议出售电力"
        : "供需基本平衡，建议持有观望",
    };
  }

  private hourToTimeSlot(hour: number): string {
    if (hour >= 0 && hour < 6) return "valley";
    if (hour >= 6 && hour < 10) return "flat";
    if (hour >= 10 && hour < 14) return "peak";
    if (hour >= 14 && hour < 18) return "flat";
    if (hour >= 18 && hour < 22) return "peak";
    return "valley";
  }

  private generateRecommendedTrades(deliveryDate: Date, strategy: any, forecast: LoadForecast) {
    const trades = [];

    if (strategy.totalDeficit > 100) {
      trades.push({
        tradeType: TradeType.BUY,
        quantity: roundTo(strategy.totalDeficit, 2),
        bidPrice: strategy.avgBuyPrice,
        estimatedAmount: roundTo(strategy.totalDeficit * strategy.avgBuyPrice, 2),
        deliveryDate,
        reason: "预计供电缺口，建议购入电力",
      });
    }

    if (strategy.totalSurplus > 100) {
      trades.push({
        tradeType: TradeType.SELL,
        quantity: roundTo(strategy.totalSurplus, 2),
        bidPrice: strategy.avgSellPrice,
        estimatedAmount: roundTo(strategy.totalSurplus * strategy.avgSellPrice, 2),
        deliveryDate,
        reason: "预计电力盈余，建议出售电力",
      });
    }

    const peakBuyHours = strategy.hourlyAnalysis
      .filter((a: any) => a.action === "buy" && a.quantity > 50)
      .map((a: any) => ({ hour: a.hour, quantity: a.quantity, price: a.buyPrice }));

    if (peakBuyHours.length > 0) {
      trades.push({
        tradeType: TradeType.BUY,
        quantity: roundTo(peakBuyHours.reduce((s: number, a: any) => s + a.quantity, 0), 2),
        bidPrice: roundTo(peakBuyHours.reduce((s: number, a: any) => s + a.price * a.quantity, 0) / peakBuyHours.reduce((s: number, a: any) => s + a.quantity, 0), 4),
        estimatedAmount: roundTo(peakBuyHours.reduce((s: number, a: any) => s + a.estimatedAmount, 0), 2),
        deliveryDate,
        hourlyBreakdown: peakBuyHours,
        reason: "高峰时段供电缺口，分时段购入",
      });
    }

    return trades;
  }

  async createTrade(tradeData: any, traderId: string) {
    const trade = this.tradeRepo.create({
      ...tradeData,
      tradeNo: generateOrderNo("TRADE"),
      status: TradeStatus.DRAFT,
      createdBy: traderId,
      totalAmount: roundTo(tradeData.quantity * tradeData.bidPrice, 2),
    });

    await this.tradeRepo.save(trade);
    logger.info(`交易员 ${traderId} 创建交易 ${trade.tradeNo}`);
    return trade;
  }

  async submitForApproval(tradeId: string, traderId: string) {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) {
      throw new Error("交易不存在");
    }

    if (trade.status !== TradeStatus.DRAFT) {
      throw new Error("交易状态不允许提交审批");
    }

    trade.status = TradeStatus.PENDING_APPROVAL;
    trade.submittedBy = traderId;
    trade.submittedAt = new Date().toISOString() as any;
    await this.tradeRepo.save(trade);

    sendToRole(UserRole.ADMIN, NotificationType.TRADE, {
      title: "交易待审批",
      content: `交易 ${trade.tradeNo} 已提交审批，请及时处理`,
      severity: NotificationSeverity.INFO,
      trade,
    });

    return trade;
  }

  async approveTrade(tradeId: string, approverId: string, approvalRemark?: string) {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) {
      throw new Error("交易不存在");
    }

    if (trade.status !== TradeStatus.PENDING_APPROVAL) {
      throw new Error("交易状态不允许审批");
    }

    trade.status = TradeStatus.APPROVED;
    trade.approvedBy = approverId;
    trade.approvedAt = new Date();
    trade.approvalRemark = approvalRemark;
    await this.tradeRepo.save(trade);

    sendToUser(trade.createdBy!, NotificationType.TRADE, {
      title: "交易已审批通过",
      content: `交易 ${trade.tradeNo} 已通过审批`,
      trade,
    });

    return trade;
  }

  async rejectTrade(tradeId: string, approverId: string, approvalRemark: string) {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) {
      throw new Error("交易不存在");
    }

    if (trade.status !== TradeStatus.PENDING_APPROVAL) {
      throw new Error("交易状态不允许审批");
    }

    trade.status = TradeStatus.REJECTED;
    trade.approvedBy = approverId;
    trade.approvedAt = new Date();
    trade.approvalRemark = approvalRemark;
    await this.tradeRepo.save(trade);

    sendToUser(trade.createdBy!, NotificationType.TRADE, {
      title: "交易未通过审批",
      content: `交易 ${trade.tradeNo} 未通过审批: ${approvalRemark}`,
      severity: NotificationSeverity.WARNING,
      trade,
    });

    return trade;
  }

  async submitTrade(tradeId: string, traderId: string) {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) {
      throw new Error("交易不存在");
    }

    if (trade.status !== TradeStatus.APPROVED) {
      throw new Error("交易未通过审批，无法提交");
    }

    trade.status = TradeStatus.SUBMITTED;
    trade.submittedBy = traderId;
    trade.submittedAt = new Date().toISOString() as any;
    await this.tradeRepo.save(trade);

    setTimeout(() => {
      this.simulateTradeExecution(tradeId);
    }, 5000);

    return trade;
  }

  private async simulateTradeExecution(tradeId: string) {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade || trade.status !== TradeStatus.SUBMITTED) return;

    const fillRate = Math.min(1, 0.7 + Math.random() * 0.3);
    const filledQuantity = roundTo(trade.quantity * fillRate, 2);
    const strikePrice = roundTo(trade.bidPrice * (0.98 + Math.random() * 0.04), 4);

    trade.filledQuantity = filledQuantity;
    trade.strikePrice = strikePrice;
    trade.settlementAmount = roundTo(filledQuantity * strikePrice, 2);

    if (fillRate >= 0.99) {
      trade.status = TradeStatus.FULLY_FILLED;
    } else if (fillRate > 0) {
      trade.status = TradeStatus.PARTIAL_FILLED;
    }

    trade.contractNo = generateOrderNo("CONTRACT");
    await this.tradeRepo.save(trade);

    sendToUser(trade.createdBy!, NotificationType.TRADE, {
      title: "交易成交",
      content: `交易 ${trade.tradeNo} ${fillRate >= 0.99 ? "全部" : "部分"}成交，成交量 ${filledQuantity} kWh`,
      severity: NotificationSeverity.INFO,
      trade,
    });

    sendToRole(UserRole.TRADER, NotificationType.TRADE, {
      title: "交易成交通知",
      content: `交易 ${trade.tradeNo} 成交 ${filledQuantity} kWh，成交价 ${strikePrice} 元/kWh`,
      trade,
    });

    logger.info(`交易 ${trade.tradeNo} 成交: ${filledQuantity} kWh @ ${strikePrice} 元`);
  }

  async settleTrade(tradeId: string, settledBy: string) {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) {
      throw new Error("交易不存在");
    }

    if (trade.status !== TradeStatus.FULLY_FILLED && trade.status !== TradeStatus.PARTIAL_FILLED) {
      throw new Error("交易未成交，无法结算");
    }

    trade.status = TradeStatus.SETTLED;
    trade.settledBy = settledBy;
    trade.settledAt = new Date();
    await this.tradeRepo.save(trade);

    return trade;
  }

  async getTrades(status?: TradeStatus, tradeType?: TradeType, page: number = 1, pageSize: number = 20) {
    const where: any = {};
    if (status) where.status = status;
    if (tradeType) where.tradeType = tradeType;

    const [items, total] = await this.tradeRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }

  async getTradeDetail(tradeId: string) {
    return this.tradeRepo.findOne({ where: { id: tradeId } });
  }

  async getMyTrades(traderId: string, status?: TradeStatus, page: number = 1, pageSize: number = 20) {
    const where: any = { createdBy: traderId };
    if (status) where.status = status;

    const [items, total] = await this.tradeRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }
}

export const powerTradeService = new PowerTradeService();
