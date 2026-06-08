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
import { BillDetail } from "./BillDetail";

export enum BillStatus {
  DRAFT = "draft",
  ISSUED = "issued",
  UNPAID = "unpaid",
  PARTIAL_PAID = "partial_paid",
  PAID = "paid",
  OVERDUE = "overdue",
  SUSPENDED = "suspended",
  PAID_OFF = "paid_off",
  CANCELLED = "cancelled",
}

@Entity()
export class Bill {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  billNo: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.bills)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({
    type: "enum",
    enum: BillStatus,
    default: BillStatus.DRAFT,
  })
  status: BillStatus;

  @Column({ type: "date" })
  billingPeriodStart: Date;

  @Column({ type: "date" })
  billingPeriodEnd: Date;

  @Column({ type: "date", nullable: true })
  dueDate: Date;

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  peakUsage: number;

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  flatUsage: number;

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  valleyUsage: number;

  @Column({ type: "decimal", precision: 15, scale: 4 })
  totalUsage: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  peakAmount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  flatAmount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  valleyAmount: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  energyCharge: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  demandCharge: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  adjustmentAmount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  penaltyAmount: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  unpaidAmount: number;

  @Column({ type: "text", nullable: true })
  meterReadingData: string;

  @Column({ type: "date", nullable: true })
  issueDate: Date;

  @Column({ type: "date", nullable: true })
  paidDate: Date;

  @Column({ nullable: true })
  collectorId: string;

  @Column({ type: "timestamp", nullable: true })
  limitPowerIssuedAt: Date;

  @Column({ type: "text", nullable: true })
  remark: string;

  @OneToMany(() => BillDetail, (detail) => detail.bill)
  details: BillDetail[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
