import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Device } from "./Device";

@Entity()
@Index(["deviceId", "timestamp"])
export class DeviceData {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  deviceId: string;

  @ManyToOne(() => Device, (device) => device.deviceData)
  @JoinColumn({ name: "deviceId" })
  device: Device;

  @Column({ type: "timestamp" })
  @Index()
  timestamp: Date;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  powerOutput: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  powerInput: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  stateOfCharge: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  voltage: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  current: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  temperature: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  frequency: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  powerFactor: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  totalEnergyGenerated: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  totalEnergyConsumed: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  loadRate: number;

  @Column({ type: "jsonb", nullable: true })
  rawData: any;

  @CreateDateColumn()
  createdAt: Date;
}
