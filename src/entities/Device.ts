import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { DeviceData } from "./DeviceData";
import { DispatchCommand } from "./DispatchCommand";
import { Alert } from "./Alert";

export enum DeviceType {
  PV = "pv",
  STORAGE = "storage",
  TRANSFORMER = "transformer",
  LINE = "line",
  METER = "meter",
  INVERTER = "inverter",
  CHARGING_STATION = "charging_station",
}

export enum DeviceStatus {
  NORMAL = "normal",
  WARNING = "warning",
  FAULT = "fault",
  OFFLINE = "offline",
  MAINTENANCE = "maintenance",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

@Entity()
export class Device {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  deviceCode: string;

  @Column()
  name: string;

  @Column({
    type: "enum",
    enum: DeviceType,
  })
  deviceType: DeviceType;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, (user) => user.devices, { nullable: true })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({
    type: "enum",
    enum: DeviceStatus,
    default: DeviceStatus.NORMAL,
  })
  status: DeviceStatus;

  @Column({
    type: "enum",
    enum: RiskLevel,
    default: RiskLevel.LOW,
  })
  riskLevel: RiskLevel;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  capacity: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  currentOutput: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  currentInput: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  stateOfCharge: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  temperature: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  voltage: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  current: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  loadRate: number;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ length: 200, nullable: true })
  location: string;

  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  latitude: number;

  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  longitude: number;

  @Column({ type: "timestamp", nullable: true })
  lastFaultTime: Date;

  @Column({ default: 0 })
  faultCount30Days: number;

  @Column({ type: "date", nullable: true })
  installationDate: Date;

  @Column({ type: "date", nullable: true })
  lastMaintenanceDate: Date;

  @Column({ type: "text", nullable: true })
  specification: string;

  @Column({ type: "text", nullable: true })
  remark: string;

  @OneToMany(() => DeviceData, (data) => data.device)
  deviceData: DeviceData[];

  @OneToMany(() => DispatchCommand, (cmd) => cmd.device)
  dispatchCommands: DispatchCommand[];

  @OneToMany(() => Alert, (alert) => alert.device)
  alerts: Alert[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
