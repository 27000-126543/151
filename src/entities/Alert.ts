import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Device } from "./Device";
import { UserRole } from "./User";

export enum AlertType {
  OVERLOAD = "overload",
  OVERHEAT = "overheat",
  FAULT = "fault",
  OFFLINE = "offline",
  LOW_BATTERY = "low_battery",
  VOLTAGE_ABNORMAL = "voltage_abnormal",
  FREQUENCY_ABNORMAL = "frequency_abnormal",
  SUPPLY_SHORTAGE = "supply_shortage",
  DEMAND_EXCEED = "demand_exceed",
  EQUIPMENT_FAILURE = "equipment_failure",
}

export enum AlertLevel {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

export enum AlertStatus {
  PENDING = "pending",
  ACKNOWLEDGED = "acknowledged",
  PROCESSING = "processing",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

@Entity()
export class Alert {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: AlertType,
  })
  alertType: AlertType;

  @Column({
    type: "enum",
    enum: AlertLevel,
    default: AlertLevel.WARNING,
  })
  level: AlertLevel;

  @Column({
    type: "enum",
    enum: AlertStatus,
    default: AlertStatus.PENDING,
  })
  status: AlertStatus;

  @Column()
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ nullable: true })
  deviceId: string;

  @ManyToOne(() => Device, (device) => device.alerts, { nullable: true })
  @JoinColumn({ name: "deviceId" })
  device: Device;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  currentValue: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  threshold: number;

  @Column({
    type: "enum",
    enum: UserRole,
    nullable: true,
  })
  notifyRole: UserRole;

  @Column({ nullable: true })
  notifiedUserId: string;

  @Column({ nullable: true })
  acknowledgedBy: string;

  @Column({ type: "timestamp", nullable: true })
  acknowledgedAt: Date;

  @Column({ nullable: true })
  resolvedBy: string;

  @Column({ type: "timestamp", nullable: true })
  resolvedAt: Date;

  @Column({ type: "text", nullable: true })
  resolution: string;

  @Column({ type: "jsonb", nullable: true })
  relatedData: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
