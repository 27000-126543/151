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

export enum FaultLevel {
  MINOR = "minor",
  MODERATE = "moderate",
  MAJOR = "major",
  CRITICAL = "critical",
}

export enum WorkOrderStatus {
  PENDING = "pending",
  ASSIGNED = "assigned",
  DISPATCHED = "dispatched",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  VERIFIED = "verified",
  CLOSED = "closed",
  CANCELLED = "cancelled",
}

export enum RepairSkill {
  ELECTRICAL = "electrical",
  MECHANICAL = "mechanical",
  PV_SYSTEM = "pv_system",
  STORAGE_SYSTEM = "storage_system",
  TRANSFORMER = "transformer",
  POWER_LINE = "power_line",
  AUTOMATION = "automation",
}

@Entity()
export class WorkOrder {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  orderNo: string;

  @Column()
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({
    type: "enum",
    enum: FaultLevel,
  })
  faultLevel: FaultLevel;

  @Column({
    type: "enum",
    enum: WorkOrderStatus,
    default: WorkOrderStatus.PENDING,
  })
  status: WorkOrderStatus;

  @Column({ nullable: true })
  deviceId: string;

  @ManyToOne(() => Device, { nullable: true })
  @JoinColumn({ name: "deviceId" })
  device: Device;

  @Column({
    type: "enum",
    enum: RepairSkill,
    nullable: true,
  })
  requiredSkill: RepairSkill;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ length: 200, nullable: true })
  location: string;

  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  latitude: number;

  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  assignedTeamId: string;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({ type: "timestamp", nullable: true })
  assignedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  dispatchedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  verifiedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  dueDate: Date;

  @Column({ type: "text", nullable: true })
  repairContent: string;

  @Column({ type: "text", nullable: true })
  partsReplaced: string;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  repairCost: number;

  @Column({ type: "jsonb", nullable: true })
  beforeImages: string[];

  @Column({ type: "jsonb", nullable: true })
  afterImages: string[];

  @Column({ type: "text", nullable: true })
  remark: string;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  verifiedBy: string;

  @Column({ nullable: true })
  closedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
