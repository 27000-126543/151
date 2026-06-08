import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

export enum LimitOrderStatus {
  PENDING = "pending",
  ISSUED = "issued",
  EXECUTED = "executed",
  CANCELLED = "cancelled",
  RESTORED = "restored",
}

@Entity()
export class LimitPowerOrder {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  orderNo: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ nullable: true })
  billId: string;

  @Column({
    type: "enum",
    enum: LimitOrderStatus,
    default: LimitOrderStatus.PENDING,
  })
  status: LimitOrderStatus;

  @Column({ type: "text" })
  reason: string;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  limitLoad: number;

  @Column({ type: "timestamp", nullable: true })
  effectiveTime: Date;

  @Column({ type: "timestamp", nullable: true })
  executedTime: Date;

  @Column({ type: "timestamp", nullable: true })
  restoredTime: Date;

  @Column({ nullable: true })
  issuedBy: string;

  @Column({ nullable: true })
  collectorId: string;

  @Column({ type: "text", nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
