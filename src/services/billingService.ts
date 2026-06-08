import { Repository } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Bill, BillStatus } from "../entities/Bill";
import { BillDetail } from "../entities/BillDetail";
import { LimitPowerOrder, LimitOrderStatus } from "../entities/LimitPowerOrder";
import { User, UserRole } from "../entities/User";
import { DeviceData } from "../entities/DeviceData";
import { ElectricityPrice, PriceType, TimeSlot } from "../entities/ElectricityPrice";
import { logger } from "../utils/logger";
import {
  generateOrderNo,
  roundTo,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addDays,
  diffDays,
} from "../utils/helpers";
import { sendToUser, sendToRole } from "./notificationService";
import { NotificationType, NotificationSeverity } from "../entities/Notification";

export class BillingService {
  private billRepo: Repository<Bill>;
  private billDetailRepo: Repository<BillDetail>;
  private limitOrderRepo: Repository<LimitPowerOrder>;
  private userRepo: Repository<User>;
  private deviceDataRepo: Repository<DeviceData>;
  private priceRepo: Repository<ElectricityPrice>;

  constructor() {
    this.billRepo = AppDataSource.getRepository(Bill);
    this.billDetailRepo = AppDataSource.getRepository(BillDetail);
    this.limitOrderRepo = AppDataSource.getRepository(LimitPowerOrder);
    this.userRepo = AppDataSource.getRepository(User);
    this.deviceDataRepo = AppDataSource.getRepository(DeviceData);
    this.priceRepo = AppDataSource.getRepository(ElectricityPrice);
  }

  async generateMonthlyBills(year: number, month: number) {
    const billingStart = new Date(year, month - 1, 1);
    const billingEnd = endOfMonth(billingStart);

    const users = await this.userRepo.find({
      where: { isActive: true },
      relations: ["devices"],
    });

    const bills: Bill[] = [];

    for (const user of users) {
      if (user.devices.length === 0) continue;

      try {
        const bill = await this.generateUserBill(user, billingStart, billingEnd);
        bills.push(bill);
      } catch (error) {
        logger.error(`生成用户 ${user.id} 账单失败: ${error}`);
      }
    }

    logger.info(`生成月度账单: ${bills.length} 份`);
    return bills;
  }

  async generateUserBill(user: User, billingStart: Date, billingEnd: Date) {
    const prices = await this.priceRepo.find({
      where: { priceType: PriceType.GRID, isActive: true },
    });

    const priceMap: Record<string, number> = {};
    prices.forEach((p) => {
      priceMap[p.timeSlot] = p.price;
    });

    let peakUsage = 0,
      flatUsage = 0,
      valleyUsage = 0;

    const userDeviceIds = user.devices.map((d) => d.id);

    const usageData = await this.calculateUsageByTimeSlot(
      userDeviceIds,
      billingStart,
      billingEnd
    );

    peakUsage = usageData.peak;
    flatUsage = usageData.flat;
    valleyUsage = usageData.valley;

    const totalUsage = roundTo(peakUsage + flatUsage + valleyUsage, 4);

    const peakAmount = roundTo(peakUsage * (priceMap.peak || 0.8), 2);
    const flatAmount = roundTo(flatUsage * (priceMap.flat || 0.5), 2);
    const valleyAmount = roundTo(valleyUsage * (priceMap.valley || 0.3), 2);

    const energyCharge = roundTo(peakAmount + flatAmount + valleyAmount, 2);
    const demandCharge = user.userType === "industrial" ? roundTo(user.maxInterruptibleLoad * 10, 2) : 0;
    const totalAmount = roundTo(energyCharge + demandCharge, 2);

    const existingBill = await this.billRepo.findOne({
      where: {
        userId: user.id,
        billingPeriodStart: startOfDay(billingStart),
        billingPeriodEnd: endOfDay(billingEnd),
      },
    });

    if (existingBill) {
      return existingBill;
    }

    const bill = this.billRepo.create({
      billNo: generateOrderNo("BILL"),
      userId: user.id,
      status: BillStatus.DRAFT,
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
      dueDate: addDays(billingEnd, 15),
      peakUsage: roundTo(peakUsage, 4),
      flatUsage: roundTo(flatUsage, 4),
      valleyUsage: roundTo(valleyUsage, 4),
      totalUsage,
      peakAmount,
      flatAmount,
      valleyAmount,
      energyCharge,
      demandCharge,
      totalAmount,
      paidAmount: 0,
      unpaidAmount: totalAmount,
    });

    await this.billRepo.save(bill);

    await this.generateBillDetails(bill, usageData.hourlyData, priceMap);

    return bill;
  }

  private async calculateUsageByTimeSlot(deviceIds: string[], start: Date, end: Date) {
    let peak = 0,
      flat = 0,
      valley = 0;

    const hourlyData: number[] = Array(24).fill(0);

    const data = await this.deviceDataRepo
      .createQueryBuilder("dd")
      .where("dd.deviceId IN (:...deviceIds)", { deviceIds })
      .andWhere("dd.timestamp BETWEEN :start AND :end", { start, end })
      .getMany();

    for (const record of data) {
      const hour = record.timestamp.getHours();
      const usage = record.powerInput || 0;
      hourlyData[hour] += usage;

      const slot = this.hourToTimeSlot(hour);
      switch (slot) {
        case "peak":
          peak += usage;
          break;
        case "flat":
          flat += usage;
          break;
        case "valley":
          valley += usage;
          break;
      }
    }

    return { peak, flat, valley, hourlyData };
  }

  private hourToTimeSlot(hour: number): string {
    if (hour >= 0 && hour < 6) return "valley";
    if (hour >= 6 && hour < 10) return "flat";
    if (hour >= 10 && hour < 14) return "peak";
    if (hour >= 14 && hour < 18) return "flat";
    if (hour >= 18 && hour < 22) return "peak";
    return "valley";
  }

  private async generateBillDetails(bill: Bill, hourlyData: number[], priceMap: Record<string, number>) {
    const details: BillDetail[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const slot = this.hourToTimeSlot(hour);
      const unitPrice = priceMap[slot] || 0.5;
      const usage = hourlyData[hour];

      if (usage <= 0) continue;

      const detail = this.billDetailRepo.create({
        billId: bill.id,
        timeSlot: slot as TimeSlot,
        startTime: new Date(bill.billingPeriodStart.getFullYear(), bill.billingPeriodStart.getMonth(), bill.billingPeriodStart.getDate(), hour, 0, 0),
        endTime: new Date(bill.billingPeriodStart.getFullYear(), bill.billingPeriodStart.getMonth(), bill.billingPeriodStart.getDate(), hour, 59, 59),
        usage: roundTo(usage, 4),
        unitPrice,
        amount: roundTo(usage * unitPrice, 2),
      });

      details.push(detail);
    }

    return this.billDetailRepo.save(details);
  }

  async issueBill(billId: string) {
    const bill = await this.billRepo.findOne({ where: { id: billId }, relations: ["user"] });
    if (!bill) {
      throw new Error("账单不存在");
    }

    if (bill.status !== BillStatus.DRAFT) {
      throw new Error("账单状态不允许发布");
    }

    bill.status = BillStatus.UNPAID;
    bill.issueDate = new Date();
    await this.billRepo.save(bill);

    sendToUser(bill.userId, NotificationType.BILL, {
      title: "新账单已生成",
      content: `您的 ${bill.billingPeriodStart.getMonth() + 1} 月账单已生成，应缴金额 ${bill.totalAmount} 元，请在 ${bill.dueDate?.toLocaleDateString()} 前缴纳`,
      severity: NotificationSeverity.INFO,
      bill,
    });

    return bill;
  }

  async payBill(billId: string, amount: number) {
    const bill = await this.billRepo.findOne({ where: { id: billId }, relations: ["user"] });
    if (!bill) {
      throw new Error("账单不存在");
    }

    if (bill.status !== BillStatus.UNPAID && bill.status !== BillStatus.PARTIAL_PAID && bill.status !== BillStatus.OVERDUE) {
      throw new Error("账单状态不允许支付");
    }

    bill.paidAmount = roundTo((bill.paidAmount || 0) + amount, 2);
    bill.unpaidAmount = roundTo(bill.totalAmount - bill.paidAmount, 2);

    if (bill.unpaidAmount <= 0) {
      bill.status = BillStatus.PAID;
      bill.paidDate = new Date();
    } else {
      bill.status = BillStatus.PARTIAL_PAID;
    }

    await this.billRepo.save(bill);

    if (bill.user) {
      bill.user.balance = roundTo((bill.user.balance || 0) - amount, 2);
      await this.userRepo.save(bill.user);
    }

    if (bill.unpaidAmount <= 0) {
      sendToUser(bill.userId, NotificationType.BILL, {
        title: "账单已结清",
        content: `您的账单 ${bill.billNo} 已结清，感谢您的配合`,
        bill,
      });

      await this.cancelLimitPowerOrder(billId);
    } else {
      sendToUser(bill.userId, NotificationType.BILL, {
        title: "账单部分支付",
        content: `您已支付 ${amount} 元，剩余 ${bill.unpaidAmount} 元未缴`,
        bill,
      });
    }

    return bill;
  }

  async checkOverdueBills() {
    const today = new Date();
    const overdueBills = await this.billRepo.find({
      where: [
        { status: BillStatus.UNPAID },
        { status: BillStatus.PARTIAL_PAID },
      ],
      relations: ["user"],
    });

    const result = {
      newOverdue: [] as Bill[],
      needLimitPower: [] as Bill[],
      alreadyOverdue: [] as Bill[],
    };

    for (const bill of overdueBills) {
      if (!bill.dueDate) continue;

      const daysOverdue = diffDays(today, bill.dueDate);

      if (daysOverdue > 0 && bill.status !== BillStatus.OVERDUE) {
        bill.status = BillStatus.OVERDUE;
        bill.penaltyAmount = roundTo(bill.unpaidAmount * 0.001 * daysOverdue, 2);
        bill.totalAmount = roundTo(bill.energyCharge + bill.demandCharge + bill.penaltyAmount, 2);
        bill.unpaidAmount = roundTo(bill.totalAmount - bill.paidAmount, 2);

        await this.billRepo.save(bill);

        sendToUser(bill.userId, NotificationType.BILL, {
          title: "账单已逾期",
          content: `您的账单 ${bill.billNo} 已逾期 ${daysOverdue} 天，请尽快缴纳，否则将面临限电措施`,
          severity: NotificationSeverity.WARNING,
          bill,
        });

        result.newOverdue.push(bill);
      }

      if (daysOverdue > 30) {
        const existingOrder = await this.limitOrderRepo.findOne({
          where: { billId: bill.id, status: LimitOrderStatus.ISSUED },
        });

        if (!existingOrder) {
          const limitOrder = await this.createLimitPowerOrder(bill);
          result.needLimitPower.push(bill);

          sendToRole(UserRole.COLLECTOR, NotificationType.BILL, {
            title: "需要催收并限电",
            content: `用户 ${bill.user?.realName} 的账单 ${bill.billNo} 已逾期超过30天，需执行催收和限电`,
            severity: NotificationSeverity.CRITICAL,
            bill,
            limitOrder,
          });
        } else {
          result.alreadyOverdue.push(bill);
        }
      }
    }

    logger.info(`逾期账单检查: 新增逾期 ${result.newOverdue.length} 份, 需限电 ${result.needLimitPower.length} 份`);
    return result;
  }

  private async createLimitPowerOrder(bill: Bill) {
    const limitOrder = this.limitOrderRepo.create({
      orderNo: generateOrderNo("LIMIT"),
      userId: bill.userId,
      billId: bill.id,
      status: LimitOrderStatus.PENDING,
      reason: `账单 ${bill.billNo} 逾期超过30天，欠费 ${bill.unpaidAmount} 元`,
      limitLoad: roundTo((bill.user?.maxInterruptibleLoad || 100) * 0.3, 2),
      effectiveTime: new Date(),
    });

    await this.limitOrderRepo.save(limitOrder);
    return limitOrder;
  }

  async issueLimitPowerOrder(orderId: string, issuerId: string, collectorId: string) {
    const order = await this.limitOrderRepo.findOne({
      where: { id: orderId },
      relations: ["user"],
    });

    if (!order) {
      throw new Error("限电指令不存在");
    }

    order.status = LimitOrderStatus.ISSUED;
    order.issuedBy = issuerId;
    order.collectorId = collectorId;
    order.executedTime = new Date();
    await this.limitOrderRepo.save(order);

    if (order.user) {
      order.user.isActive = false;
      await this.userRepo.save(order.user);
    }

    sendToUser(order.userId, NotificationType.BILL, {
      title: "限电通知",
      content: `由于您的账单逾期超过30天，已对您执行限电措施。请尽快缴清欠费以恢复供电`,
      severity: NotificationSeverity.CRITICAL,
      limitOrder: order,
    });

    return order;
  }

  async restorePower(orderId: string) {
    const order = await this.limitOrderRepo.findOne({
      where: { id: orderId },
      relations: ["user"],
    });

    if (!order) {
      throw new Error("限电指令不存在");
    }

    order.status = LimitOrderStatus.RESTORED;
    order.restoredTime = new Date();
    await this.limitOrderRepo.save(order);

    if (order.user) {
      order.user.isActive = true;
      await this.userRepo.save(order.user);
    }

    sendToUser(order.userId, NotificationType.BILL, {
      title: "供电已恢复",
      content: `您的电费已缴清，供电已恢复正常。感谢您的配合`,
      severity: NotificationSeverity.INFO,
    });

    return order;
  }

  private async cancelLimitPowerOrder(billId: string) {
    const orders = await this.limitOrderRepo.find({
      where: { billId, status: LimitOrderStatus.ISSUED },
    });

    for (const order of orders) {
      await this.restorePower(order.id);
    }
  }

  async getBills(userId?: string, status?: BillStatus, page: number = 1, pageSize: number = 20) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const [items, total] = await this.billRepo.findAndCount({
      where,
      relations: ["user", "details"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }

  async getBillDetail(billId: string, userId?: string) {
    const where: any = { id: billId };
    if (userId) where.userId = userId;

    return this.billRepo.findOne({
      where,
      relations: ["user", "details"],
    });
  }

  async getLimitOrders(userId?: string, status?: LimitOrderStatus, page: number = 1, pageSize: number = 20) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const [items, total] = await this.limitOrderRepo.findAndCount({
      where,
      relations: ["user"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }
}

export const billingService = new BillingService();
