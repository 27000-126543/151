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

export enum CommandType {
  GRID_CONNECT = "grid_connect",
  GRID_DISCONNECT = "grid_disconnect",
  CHARGE = "charge",
  DISCHARGE = "discharge",
  POWER_OUTPUT_ADJUST = "power_output_adjust",
  LOAD_SHEDDING = "load_shedding",
  START = "start",
  STOP = "stop",
  MAINTENANCE = "maintenance",
}

export enum CommandStatus {
  PENDING = "pending",
  SENT = "sent",
  EXECUTING = "executing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

@Entity()
export class DispatchCommand {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  deviceId: string;

  @ManyToOne(() => Device, (device) => device.dispatchCommands)
  @JoinColumn({ name: "deviceId" })
  device: Device;

  @Column({
    type: "enum",
    enum: CommandType,
  })
  commandType: CommandType;

  @Column({
    type: "enum",
    enum: CommandStatus,
    default: CommandStatus.PENDING,
  })
  status: CommandStatus;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  targetValue: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  actualValue: number;

  @Column({ type: "timestamp", nullable: true })
  scheduledTime: Date;

  @Column({ type: "timestamp", nullable: true })
  executedTime: Date;

  @Column({ type: "timestamp", nullable: true })
  completedTime: Date;

  @Column({ type: "text", nullable: true })
  reason: string;

  @Column({ type: "text", nullable: true })
  failureReason: string;

  @Column({ length: 100, nullable: true })
  source: string;

  @Column({ type: "jsonb", nullable: true })
  additionalParams: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
