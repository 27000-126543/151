import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { DemandResponseTask } from "./DemandResponseTask";

export enum ResponseType {
  PEAK_SHAVING = "peak_shaving",
  EMERGENCY = "emergency",
  PRICE_RESPONSE = "price_response",
  CAPACITY = "capacity",
}

export enum ResponseStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  SETTLED = "settled",
}

@Entity()
export class DemandResponse {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  responseNo: string;

  @Column()
  name: string;

  @Column({
    type: "enum",
    enum: ResponseType,
  })
  responseType: ResponseType;

  @Column({
    type: "enum",
    enum: ResponseStatus,
    default: ResponseStatus.DRAFT,
  })
  status: ResponseStatus;

  @Column({ type: "timestamp" })
  startTime: Date;

  @Column({ type: "timestamp" })
  endTime: Date;

  @Column({ type: "decimal", precision: 15, scale: 2 })
  targetLoadReduction: number;

  @Column({ type: "decimal", precision: 15, scale: 2, nullable: true })
  actualLoadReduction: number;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  incentivePrice: number;

  @Column({ type: "decimal", precision: 15, scale: 2, nullable: true })
  totalIncentive: number;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "jsonb", nullable: true })
  eligibilityCriteria: {
    minLoad?: number;
    userTypes?: string[];
    regions?: string[];
  };

  @Column({ nullable: true })
  publishedBy: string;

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date;

  @Column({ nullable: true })
  settledBy: string;

  @Column({ type: "timestamp", nullable: true })
  settledAt: Date;

  @OneToMany(() => DemandResponseTask, (task) => task.demandResponse)
  tasks: DemandResponseTask[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
