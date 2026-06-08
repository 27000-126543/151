import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { DemandResponse } from "./DemandResponse";
import { User } from "./User";

export enum TaskStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  SETTLED = "settled",
}

@Entity()
export class DemandResponseTask {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  demandResponseId: string;

  @ManyToOne(() => DemandResponse, (dr) => dr.tasks)
  @JoinColumn({ name: "demandResponseId" })
  demandResponse: DemandResponse;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.demandResponseTasks)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({
    type: "enum",
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  assignedLoadReduction: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  actualLoadReduction: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  baselineLoad: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  incentiveAmount: number;

  @Column({ type: "timestamp", nullable: true })
  acceptedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  settledAt: Date;

  @Column({ type: "text", nullable: true })
  rejectionReason: string;

  @Column({ type: "text", nullable: true })
  failureReason: string;

  @Column({ type: "text", nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
