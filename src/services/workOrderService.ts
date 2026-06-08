import { Repository } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { WorkOrder, WorkOrderStatus, FaultLevel, RepairSkill } from "../entities/WorkOrder";
import { RepairTeam, TeamStatus } from "../entities/RepairTeam";
import { Device, DeviceStatus, RiskLevel } from "../entities/Device";
import { Alert, AlertType } from "../entities/Alert";
import { UserRole } from "../entities/User";
import { logger } from "../utils/logger";
import { generateOrderNo, roundTo, addDays, diffDays } from "../utils/helpers";
import { sendToRole, sendToUser } from "./notificationService";
import { NotificationType, NotificationSeverity } from "../entities/Notification";

export class WorkOrderService {
  private orderRepo: Repository<WorkOrder>;
  private teamRepo: Repository<RepairTeam>;
  private deviceRepo: Repository<Device>;
  private alertRepo: Repository<Alert>;

  constructor() {
    this.orderRepo = AppDataSource.getRepository(WorkOrder);
    this.teamRepo = AppDataSource.getRepository(RepairTeam);
    this.deviceRepo = AppDataSource.getRepository(Device);
    this.alertRepo = AppDataSource.getRepository(Alert);
  }

  async createWorkOrderFromAlert(alertId: string) {
    const alert = await this.alertRepo.findOne({
      where: { id: alertId },
      relations: ["device"],
    });

    if (!alert) {
      throw new Error("告警不存在");
    }

    if (!alert.device) {
      throw new Error("告警未关联设备");
    }

    const faultLevel = this.alertLevelToFaultLevel(alert.level);
    const requiredSkill = this.deviceTypeToSkill(alert.device.deviceType);

    const workOrder = this.orderRepo.create({
      orderNo: generateOrderNo("WO"),
      title: `设备故障抢修 - ${alert.device.name}`,
      description: alert.description,
      faultLevel,
      status: WorkOrderStatus.PENDING,
      deviceId: alert.deviceId,
      requiredSkill,
      region: alert.device.region,
      location: alert.device.location,
      latitude: alert.device.latitude,
      longitude: alert.device.longitude,
      dueDate: this.calculateDueDate(faultLevel),
      createdBy: "system",
    });

    await this.orderRepo.save(workOrder);

    const assignment = await this.assignWorkOrder(workOrder);

    alert.device.status = DeviceStatus.FAULT;
    alert.device.lastFaultTime = new Date();
    await this.deviceRepo.save(alert.device);

    await this.updateDeviceRiskLevel(alert.deviceId);

    logger.info(`生成抢修工单 ${workOrder.orderNo}，分配给 ${assignment?.assignedTeamId || "待分配"}`);
    return { workOrder, assignment };
  }

  private alertLevelToFaultLevel(alertLevel: string): FaultLevel {
    const mapping: Record<string, FaultLevel> = {
      critical: FaultLevel.CRITICAL,
      error: FaultLevel.MAJOR,
      warning: FaultLevel.MODERATE,
      info: FaultLevel.MINOR,
    };
    return mapping[alertLevel] || FaultLevel.MODERATE;
  }

  private deviceTypeToSkill(deviceType: string): RepairSkill {
    const mapping: Record<string, RepairSkill> = {
      pv: RepairSkill.PV_SYSTEM,
      storage: RepairSkill.STORAGE_SYSTEM,
      transformer: RepairSkill.TRANSFORMER,
      line: RepairSkill.POWER_LINE,
      inverter: RepairSkill.ELECTRICAL,
      charging_station: RepairSkill.ELECTRICAL,
    };
    return mapping[deviceType] || RepairSkill.ELECTRICAL;
  }

  private calculateDueDate(faultLevel: FaultLevel): Date {
    const now = new Date();
    switch (faultLevel) {
      case FaultLevel.CRITICAL:
        return new Date(now.getTime() + 2 * 60 * 60 * 1000);
      case FaultLevel.MAJOR:
        return new Date(now.getTime() + 4 * 60 * 60 * 1000);
      case FaultLevel.MODERATE:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case FaultLevel.MINOR:
        return new Date(now.getTime() + 48 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private async assignWorkOrder(workOrder: WorkOrder) {
    const availableTeams = await this.teamRepo.find({
      where: {
        status: TeamStatus.IDLE,
        isActive: true,
        region: workOrder.region || undefined as any,
      },
    });

    const eligibleTeams = availableTeams.filter((team) =>
      team.skills.includes(workOrder.requiredSkill!)
    );

    if (eligibleTeams.length === 0) {
      sendToRole(UserRole.ADMIN, NotificationType.WORK_ORDER, {
        title: "工单无法自动分配",
        content: `工单 ${workOrder.orderNo} 没有匹配的抢修队，请手动分配`,
        severity: NotificationSeverity.WARNING,
        workOrder,
      });
      return null;
    }

    let bestTeam = eligibleTeams[0];
    let bestScore = Infinity;

    for (const team of eligibleTeams) {
      const distance = this.calculateDistance(
        workOrder.latitude,
        workOrder.longitude,
        team.baseLatitude,
        team.baseLongitude
      );
      const workload = team.currentWorkload;
      const skillMatch = team.skills.indexOf(workOrder.requiredSkill!) === 0 ? 0.8 : 1;

      const score = distance * 0.5 + workload * 0.3 + skillMatch * 0.2;

      if (score < bestScore) {
        bestScore = score;
        bestTeam = team;
      }
    }

    workOrder.assignedTeamId = bestTeam.id;
    workOrder.assignedTo = bestTeam.teamName;
    workOrder.status = WorkOrderStatus.ASSIGNED;
    workOrder.assignedAt = new Date();
    await this.orderRepo.save(workOrder);

    bestTeam.status = TeamStatus.BUSY;
    bestTeam.currentWorkload += 1;
    await this.teamRepo.save(bestTeam);

    sendToRole(UserRole.MAINTENANCE, NotificationType.WORK_ORDER, {
      title: "新工单分配",
      content: `抢修队 ${bestTeam.teamName} 收到新工单 ${workOrder.orderNo}`,
      severity: NotificationSeverity.INFO,
      workOrder,
      team: bestTeam,
    });

    return workOrder;
  }

  private calculateDistance(
    lat1?: number,
    lon1?: number,
    lat2?: number,
    lon2?: number
  ): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 10;

    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async updateDeviceRiskLevel(deviceId: string) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) return;

    const thirtyDaysAgo = addDays(new Date(), -30);
    const recentOrders = await this.orderRepo.count({
      where: {
        deviceId,
        createdAt: { $gt: thirtyDaysAgo } as any,
      },
    });

    device.faultCount30Days = recentOrders;

    if (recentOrders >= 3) {
      device.riskLevel = RiskLevel.CRITICAL;
    } else if (recentOrders >= 2) {
      device.riskLevel = RiskLevel.HIGH;
    } else if (recentOrders >= 1) {
      device.riskLevel = RiskLevel.MEDIUM;
    } else {
      device.riskLevel = RiskLevel.LOW;
    }

    if (recentOrders >= 2 && device.lastFaultTime) {
      const daysSinceLastFault = diffDays(new Date(), device.lastFaultTime);
      if (daysSinceLastFault < 30) {
        device.riskLevel = RiskLevel.CRITICAL;

        sendToRole(UserRole.OPERATOR, NotificationType.ALERT, {
          title: "高风险设备警告",
          content: `设备 ${device.name} (${device.deviceCode}) 30天内重复故障 ${recentOrders} 次，标记为高风险`,
          severity: NotificationSeverity.CRITICAL,
          deviceId,
          faultCount: recentOrders,
        });
      }
    }

    await this.deviceRepo.save(device);
  }

  async dispatchWorkOrder(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new Error("工单不存在");
    }

    if (order.status !== WorkOrderStatus.ASSIGNED) {
      throw new Error("工单状态不允许派单");
    }

    order.status = WorkOrderStatus.DISPATCHED;
    order.dispatchedAt = new Date();
    await this.orderRepo.save(order);

    return order;
  }

  async startWorkOrder(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new Error("工单不存在");
    }

    if (order.status !== WorkOrderStatus.DISPATCHED && order.status !== WorkOrderStatus.ASSIGNED) {
      throw new Error("工单状态不允许开始");
    }

    order.status = WorkOrderStatus.IN_PROGRESS;
    order.startedAt = new Date();
    await this.orderRepo.save(order);

    return order;
  }

  async completeWorkOrder(
    orderId: string,
    repairContent: string,
    partsReplaced?: string,
    repairCost?: number,
    beforeImages?: string[],
    afterImages?: string[]
  ) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ["device"],
    });

    if (!order) {
      throw new Error("工单不存在");
    }

    if (order.status !== WorkOrderStatus.IN_PROGRESS) {
      throw new Error("工单状态不允许完成");
    }

    order.status = WorkOrderStatus.COMPLETED;
    order.completedAt = new Date();
    order.repairContent = repairContent;
    order.partsReplaced = partsReplaced;
    order.repairCost = repairCost;
    order.beforeImages = beforeImages;
    order.afterImages = afterImages;
    await this.orderRepo.save(order);

    if (order.assignedTeamId) {
      const team = await this.teamRepo.findOne({ where: { id: order.assignedTeamId } });
      if (team) {
        team.currentWorkload = Math.max(0, team.currentWorkload - 1);
        if (team.currentWorkload === 0) {
          team.status = TeamStatus.IDLE;
        }
        await this.teamRepo.save(team);
      }
    }

    return order;
  }

  async verifyWorkOrder(orderId: string, verifiedBy: string, passed: boolean) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ["device"],
    });

    if (!order) {
      throw new Error("工单不存在");
    }

    if (order.status !== WorkOrderStatus.COMPLETED) {
      throw new Error("工单状态不允许验收");
    }

    if (passed) {
      order.status = WorkOrderStatus.VERIFIED;
      order.verifiedAt = new Date();
      order.verifiedBy = verifiedBy;

      if (order.device) {
        order.device.status = DeviceStatus.NORMAL;
        await this.deviceRepo.save(order.device);

        const resolvedAlerts = await this.alertRepo.find({
          where: { deviceId: order.deviceId, status: "processing" as any },
        });
        for (const alert of resolvedAlerts) {
          alert.status = "resolved" as any;
          alert.resolvedBy = verifiedBy;
          alert.resolvedAt = new Date();
          alert.resolution = `工单 ${order.orderNo} 完成修复`;
          await this.alertRepo.save(alert);
        }

        if (order.device.userId) {
          sendToUser(order.device.userId, NotificationType.WORK_ORDER, {
            title: "设备修复完成",
            content: `您的设备 ${order.device.name} 已修复完成`,
            workOrder: order,
          });
        }
      }

      await this.orderRepo.save(order);
    } else {
      order.status = WorkOrderStatus.IN_PROGRESS;
      await this.orderRepo.save(order);
    }

    return order;
  }

  async closeWorkOrder(orderId: string, closedBy: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new Error("工单不存在");
    }

    if (order.status !== WorkOrderStatus.VERIFIED) {
      throw new Error("工单状态不允许关闭");
    }

    order.status = WorkOrderStatus.CLOSED;
    order.closedBy = closedBy;
    await this.orderRepo.save(order);

    return order;
  }

  async getWorkOrders(status?: WorkOrderStatus, faultLevel?: FaultLevel, page: number = 1, pageSize: number = 20) {
    const where: any = {};
    if (status) where.status = status;
    if (faultLevel) where.faultLevel = faultLevel;

    const [items, total] = await this.orderRepo.findAndCount({
      where,
      relations: ["device"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }

  async getWorkOrderDetail(orderId: string) {
    return this.orderRepo.findOne({
      where: { id: orderId },
      relations: ["device"],
    });
  }

  async getRepairTeams(status?: TeamStatus, skill?: RepairSkill, page: number = 1, pageSize: number = 20) {
    const where: any = { isActive: true };
    if (status) where.status = status;
    if (skill) where.skills = { $contains: [skill] } as any;

    const [items, total] = await this.teamRepo.findAndCount({
      where,
      order: { currentWorkload: "ASC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }

  async createManualWorkOrder(data: any, operatorId: string) {
    const workOrder = this.orderRepo.create({
      ...data,
      orderNo: generateOrderNo("WO"),
      status: WorkOrderStatus.PENDING,
      dueDate: data.dueDate || this.calculateDueDate(data.faultLevel || FaultLevel.MODERATE),
      createdBy: operatorId,
    });

    await this.orderRepo.save(workOrder);

    const assignment = await this.assignWorkOrder(workOrder);

    logger.info(`手动创建工单 ${workOrder.orderNo}`);
    return { workOrder, assignment };
  }
}

export const workOrderService = new WorkOrderService();
