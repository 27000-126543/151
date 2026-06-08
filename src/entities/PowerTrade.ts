import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum TradeType {
  BUY = "buy",
  SELL = "sell",
}

export enum TradeStatus {
  DRAFT = "draft",
  PENDING_APPROVAL = "pending_approval",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUBMITTED = "submitted",
  PARTIAL_FILLED = "partial_filled",
  FULLY_FILLED = "fully_filled",
  CANCELLED = "cancelled",
  SETTLED = "settled",
}

export enum TradeDirection {
  SHORT_TERM = "short_term",
  MEDIUM_TERM = "medium_term",
  LONG_TERM = "long_term",
}

@Entity()
export class PowerTrade {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  tradeNo: string;

  @Column({
    type: "enum",
    enum: TradeType,
  })
  tradeType: TradeType;

  @Column({
    type: "enum",
    enum: TradeDirection,
    default: TradeDirection.SHORT_TERM,
  })
  tradeDirection: TradeDirection;

  @Column({
    type: "enum",
    enum: TradeStatus,
    default: TradeStatus.DRAFT,
  })
  status: TradeStatus;

  @Column({ type: "timestamp" })
  deliveryDate: Date;

  @Column({ type: "decimal", precision: 15, scale: 2 })
  quantity: number;

  @Column({ type: "decimal", precision: 15, scale: 2, nullable: true })
  filledQuantity: number;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  bidPrice: number;

  @Column({ type: "decimal", precision: 10, scale: 4, nullable: true })
  strikePrice: number;

  @Column({ type: "decimal", precision: 15, scale: 2, nullable: true })
  totalAmount: number;

  @Column({ type: "decimal", precision: 15, scale: 2, nullable: true })
  settlementAmount: number;

  @Column({ type: "jsonb", nullable: true })
  hourlyBreakdown: Array<{
    hour: number;
    quantity: number;
    price: number;
  }>;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ type: "text", nullable: true })
  strategy: string;

  @Column({ type: "jsonb", nullable: true })
  forecastData: any;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: "timestamp", nullable: true })
  approvedAt: Date;

  @Column({ type: "text", nullable: true })
  approvalRemark: string;

  @Column({ nullable: true })
  submittedBy: string;

  @Column({ type: "timestamp", nullable: true })
  submittedAt: string;

  @Column({ nullable: true })
  settledBy: string;

  @Column({ type: "timestamp", nullable: true })
  settledAt: Date;

  @Column({ type: "text", nullable: true })
  contractNo: string;

  @Column({ type: "text", nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
