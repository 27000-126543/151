import { Repository } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Device, DeviceType, DeviceStatus, RiskLevel } from "../entities/Device";
import { DeviceData } from "../entities/DeviceData";
import { DispatchCommand, CommandType, CommandStatus } from "../entities/DispatchCommand";
import { Alert, AlertType, AlertLevel, AlertStatus } from "../entities/Alert";
import { UserRole } from "../entities/User";
import { logger } from "../utils/logger";
import { roundTo, addDays, diffDays } from "../utils/helpers";
import { sendToRole, sendToUser, broadcast } from "./notificationService";
import { NotificationType, NotificationSeverity } from "../entities/Notification";

export class DeviceService {
  private deviceRepo: Repository<Device>;
  private deviceDataRepo: Repository<DeviceData>;
  private dispatchRepo: Repository<DispatchCommand>;
  private alertRepo: Repository<Alert>;

  constructor() {
    this.deviceRepo = AppDataSource.getRepository(Device);
    this.deviceDataRepo = AppDataSource.getRepository(DeviceData);
    this.dispatchRepo = AppDataSource.getRepository(DispatchCommand);
    this.alertRepo = AppDataSource.getRepository(Alert);
  }

  async reportDeviceData(deviceCode: string, data: any) {
    const device = await this.deviceRepo.findOne({ where: { deviceCode } });
    if (!device) {
      throw new Error("设备不存在");
    }

    const deviceData = this.deviceDataRepo.create({
      deviceId: device.id,
      timestamp: data.timestamp || new Date(),
      powerOutput: data.powerOutput,
      powerInput: data.powerInput,
      stateOfCharge: data.stateOfCharge,
      voltage: data.voltage,
      current: data.current,
      temperature: data.temperature,
      frequency: data.frequency,
      powerFactor: data.powerFactor,
      totalEnergyGenerated: data.totalEnergyGenerated,
      totalEnergyConsumed: data.totalEnergyConsumed,
      loadRate: data.loadRate,
      rawData: data.rawData,
    });

    await this.deviceDataRepo.save(deviceData);

    device.currentOutput = data.powerOutput ?? device.currentOutput;
    device.currentInput = data.powerInput ?? device.currentInput;
    device.stateOfCharge = data.stateOfCharge ?? device.stateOfCharge;
    device.temperature = data.temperature ?? device.temperature;
    device.voltage = data.voltage ?? device.voltage;
    device.current = data.current ?? device.current;
    device.loadRate = data.loadRate ?? device.loadRate;

    const anomalies = this.detectAnomalies(device, data);
    if (anomalies.length > 0) {
      device.status = DeviceStatus.WARNING;
      for (const anomaly of anomalies) {
        await this.createAlert(device, anomaly);
      }
    } else if (device.status === DeviceStatus.WARNING) {
      device.status = DeviceStatus.NORMAL;
    }

    await this.deviceRepo.save(device);
    await this.checkSupplyDemandBalance(device);

    return { device, deviceData };
  }

  private detectAnomalies(device: Device, data: any): Array<{ type: AlertType; message: string; current: number; threshold: number }> {
    const anomalies = [];

    if (data.temperature !== undefined && data.temperature > 85) {
      anomalies.push({
        type: AlertType.OVERHEAT,
        message: `设备温度过高: ${data.temperature}°C`,
        current: data.temperature,
        threshold: 85,
      });
    }

    if (data.loadRate !== undefined && data.loadRate > 90) {
      anomalies.push({
        type: AlertType.OVERLOAD,
        message: `设备负载过高: ${data.loadRate}%`,
        current: data.loadRate,
        threshold: 90,
      });
    }

    if (data.voltage !== undefined && (data.voltage < 180 || data.voltage > 260)) {
      anomalies.push({
        type: AlertType.VOLTAGE_ABNORMAL,
        message: `电压异常: ${data.voltage}V`,
        current: data.voltage,
        threshold: 220,
      });
    }

    if (data.stateOfCharge !== undefined && device.deviceType === DeviceType.STORAGE) {
      if (data.stateOfCharge < 10) {
        anomalies.push({
          type: AlertType.LOW_BATTERY,
          message: `储能设备电量过低: ${data.stateOfCharge}%`,
          current: data.stateOfCharge,
          threshold: 10,
        });
      }
    }

    if (data.frequency !== undefined && (data.frequency < 49.5 || data.frequency > 50.5)) {
      anomalies.push({
        type: AlertType.FREQUENCY_ABNORMAL,
        message: `频率异常: ${data.frequency}Hz`,
        current: data.frequency,
        threshold: 50,
      });
    }

    return anomalies;
  }

  private async createAlert(
    device: Device,
    anomaly: { type: AlertType; message: string; current: number; threshold: number }
  ) {
    const existingAlert = await this.alertRepo.findOne({
      where: {
        deviceId: device.id,
        alertType: anomaly.type,
        status: AlertStatus.PENDING,
      },
    });

    if (existingAlert) {
      return existingAlert;
    }

    const alertLevel = anomaly.current / anomaly.threshold > 1.2 ? AlertLevel.CRITICAL : AlertLevel.ERROR;

    const alert = this.alertRepo.create({
      alertType: anomaly.type,
      level: alertLevel,
      title: `设备${device.name}${this.getAlertTypeName(anomaly.type)}告警`,
      description: anomaly.message,
      deviceId: device.id,
      currentValue: anomaly.current,
      threshold: anomaly.threshold,
      notifyRole: UserRole.OPERATOR,
      relatedData: {
        deviceName: device.name,
        deviceType: device.deviceType,
        region: device.region,
      },
    });

    await this.alertRepo.save(alert);

    const notificationSeverity = alertLevel === AlertLevel.CRITICAL
      ? NotificationSeverity.CRITICAL
      : NotificationSeverity.ERROR;

    sendToRole(UserRole.OPERATOR, NotificationType.ALERT, {
      ...alert,
      severity: notificationSeverity,
    });

    if (device.userId) {
      sendToUser(device.userId, NotificationType.ALERT, {
        ...alert,
        severity: notificationSeverity,
      });
    }

    logger.warn(`设备告警: ${alert.title} - ${alert.description}`);
    return alert;
  }

  private getAlertTypeName(type: AlertType): string {
    const names: Record<AlertType, string> = {
      [AlertType.OVERLOAD]: "过载",
      [AlertType.OVERHEAT]: "过热",
      [AlertType.FAULT]: "故障",
      [AlertType.OFFLINE]: "离线",
      [AlertType.LOW_BATTERY]: "低电量",
      [AlertType.VOLTAGE_ABNORMAL]: "电压异常",
      [AlertType.FREQUENCY_ABNORMAL]: "频率异常",
      [AlertType.SUPPLY_SHORTAGE]: "供电不足",
      [AlertType.DEMAND_EXCEED]: "需求超限",
      [AlertType.EQUIPMENT_FAILURE]: "设备故障",
    };
    return names[type] || "异常";
  }

  private async checkSupplyDemandBalance(device: Device) {
    if (device.deviceType === DeviceType.PV && device.currentOutput !== undefined) {
      const storageDevices = await this.deviceRepo.find({
        where: {
          userId: device.userId,
          deviceType: DeviceType.STORAGE,
          status: DeviceStatus.NORMAL,
        },
      });

      const totalStorageCapacity = storageDevices.reduce(
        (sum, d) => sum + ((d.capacity || 0) * ((100 - (d.stateOfCharge || 0)) / 100)),
        0
      );

      const excessPower = (device.currentOutput || 0) - (device.currentInput || 0);

      if (excessPower > 0 && totalStorageCapacity > excessPower) {
        for (const storage of storageDevices) {
          const availableCapacity = (storage.capacity || 0) * ((100 - (storage.stateOfCharge || 0)) / 100);
          if (availableCapacity > 0) {
            const chargePower = Math.min(excessPower, availableCapacity * 0.5);
            await this.createDispatchCommand(
              storage.id,
              CommandType.CHARGE,
              chargePower,
              "光伏发电盈余，自动充电储能"
            );
            break;
          }
        }
      } else if (excessPower < -10) {
        for (const storage of storageDevices) {
          if ((storage.stateOfCharge || 0) > 30) {
            const dischargePower = Math.min(Math.abs(excessPower), (storage.capacity || 0) * 0.3);
            await this.createDispatchCommand(
              storage.id,
              CommandType.DISCHARGE,
              dischargePower,
              "用电需求缺口，储能放电补充"
            );
            break;
          }
        }

        if (excessPower < -50) {
          await this.createSupplyAlert(device.userId, Math.abs(excessPower));
        }
      } else if (excessPower > 100) {
        await this.createDispatchCommand(
          device.id,
          CommandType.GRID_CONNECT,
          excessPower * 0.8,
          "光伏发电盈余，并网出售"
        );
      }
    }
  }

  private async createSupplyAlert(userId: string, shortage: number) {
    const alert = this.alertRepo.create({
      alertType: AlertType.SUPPLY_SHORTAGE,
      level: AlertLevel.WARNING,
      title: "供电不足告警",
      description: `当前供电缺口约 ${roundTo(shortage, 2)} kW，请考虑调整用电计划或启用备用电源`,
      notifyRole: UserRole.OPERATOR,
      relatedData: { shortage },
    });

    await this.alertRepo.save(alert);

    if (userId) {
      sendToUser(userId, NotificationType.ALERT, {
        ...alert,
        severity: NotificationSeverity.WARNING,
      });
    }

    sendToRole(UserRole.OPERATOR, NotificationType.ALERT, {
      ...alert,
      severity: NotificationSeverity.WARNING,
    });
  }

  async createDispatchCommand(
    deviceId: string,
    commandType: CommandType,
    targetValue?: number,
    reason?: string,
    scheduledTime?: Date,
    additionalParams?: any
  ) {
    const command = this.dispatchRepo.create({
      deviceId,
      commandType,
      targetValue,
      reason,
      scheduledTime,
      additionalParams,
      source: "system",
      status: CommandStatus.PENDING,
    });

    await this.dispatchRepo.save(command);

    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (device && device.userId) {
      sendToUser(device.userId, NotificationType.DISPATCH, {
        title: "调度指令",
        content: `设备 ${device.name} 收到调度指令: ${this.getCommandTypeName(commandType)}`,
        command,
      });
    }

    logger.info(`生成调度指令: ${commandType} - ${reason}`);
    return command;
  }

  private getCommandTypeName(type: CommandType): string {
    const names: Record<CommandType, string> = {
      [CommandType.GRID_CONNECT]: "并网",
      [CommandType.GRID_DISCONNECT]: "离网",
      [CommandType.CHARGE]: "充电",
      [CommandType.DISCHARGE]: "放电",
      [CommandType.POWER_OUTPUT_ADJUST]: "功率调整",
      [CommandType.LOAD_SHEDDING]: "负荷削减",
      [CommandType.START]: "启动",
      [CommandType.STOP]: "停止",
      [CommandType.MAINTENANCE]: "维护",
    };
    return names[type] || type;
  }

  async executeCommand(commandId: string) {
    const command = await this.dispatchRepo.findOne({ where: { id: commandId } });
    if (!command) {
      throw new Error("调度指令不存在");
    }

    command.status = CommandStatus.EXECUTING;
    command.executedTime = new Date();
    await this.dispatchRepo.save(command);

    setTimeout(async () => {
      command.status = CommandStatus.COMPLETED;
      command.completedTime = new Date();
      command.actualValue = command.targetValue;
      await this.dispatchRepo.save(command);

      const device = await this.deviceRepo.findOne({ where: { id: command.deviceId } });
      if (device && device.userId) {
        sendToUser(device.userId, NotificationType.DISPATCH, {
          title: "调度指令执行完成",
          content: `设备 ${device?.name} 的调度指令已完成`,
          command,
        });
      }
    }, 2000);

    return command;
  }

  async getAlerts(deviceId?: string, status?: AlertStatus, page: number = 1, pageSize: number = 20) {
    const where: any = {};
    if (deviceId) where.deviceId = deviceId;
    if (status) where.status = status;

    const [alerts, total] = await this.alertRepo.findAndCount({
      where,
      relations: ["device"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { alerts, total };
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string) {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new Error("告警不存在");
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    await this.alertRepo.save(alert);
    return alert;
  }

  async resolveAlert(alertId: string, resolvedBy: string, resolution: string) {
    const alert = await this.alertRepo.findOne({ where: { id: alertId }, relations: ["device"] });
    if (!alert) {
      throw new Error("告警不存在");
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = new Date();
    alert.resolution = resolution;

    await this.alertRepo.save(alert);

    if (alert.device) {
      alert.device.status = DeviceStatus.NORMAL;
      await this.deviceRepo.save(alert.device);

      if (alert.device.userId) {
        sendToUser(alert.device.userId, NotificationType.ALERT, {
          title: "告警已解决",
          content: `设备 ${alert.device.name} 的告警已解决`,
          alert,
        });
      }
    }

    return alert;
  }

  async getDevicesByUser(userId: string) {
    return this.deviceRepo.find({
      where: { userId },
      relations: ["alerts", "dispatchCommands"],
      order: { createdAt: "DESC" },
    });
  }

  async getDeviceById(deviceId: string, userId?: string) {
    const where: any = { id: deviceId };
    if (userId) where.userId = userId;

    return this.deviceRepo.findOne({
      where,
      relations: ["alerts", "dispatchCommands", "deviceData"],
    });
  }

  async getDeviceHistory(deviceId: string, startDate: Date, endDate: Date) {
    return this.deviceDataRepo.find({
      where: {
        deviceId,
        timestamp: { $between: [startDate, endDate] } as any,
      },
      order: { timestamp: "ASC" },
    });
  }

  async updateDeviceRiskLevel(deviceId: string) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) return;

    const thirtyDaysAgo = addDays(new Date(), -30);
    const faultCount = await this.alertRepo.count({
      where: {
        deviceId,
        alertType: AlertType.FAULT,
        createdAt: { $gt: thirtyDaysAgo } as any,
      },
    });

    device.faultCount30Days = faultCount;

    if (faultCount >= 3) {
      device.riskLevel = RiskLevel.HIGH;
    } else if (faultCount >= 2) {
      device.riskLevel = RiskLevel.MEDIUM;
    } else {
      device.riskLevel = RiskLevel.LOW;
    }

    if (faultCount >= 2 && device.lastFaultTime) {
      const daysSinceLastFault = diffDays(new Date(), device.lastFaultTime);
      if (daysSinceLastFault < 30) {
        device.riskLevel = RiskLevel.CRITICAL;
        broadcast(NotificationType.ALERT, {
          title: "高风险设备警告",
          content: `设备 ${device.name} (${device.deviceCode}) 30天内重复故障 ${faultCount} 次，请紧急处理`,
          severity: NotificationSeverity.CRITICAL,
          deviceId,
        });
      }
    }

    await this.deviceRepo.save(device);
    return device;
  }

  async getDispatchCommands(deviceId?: string, status?: CommandStatus, page: number = 1, pageSize: number = 20) {
    const where: any = {};
    if (deviceId) where.deviceId = deviceId;
    if (status) where.status = status;

    const [commands, total] = await this.dispatchRepo.findAndCount({
      where,
      relations: ["device"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { commands, total };
  }
}

export const deviceService = new DeviceService();
