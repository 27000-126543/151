import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

export enum NotificationType {
  ALERT = "alert",
  DISPATCH = "dispatch",
  TRADE = "trade",
  BILL = "bill",
  DEMAND_RESPONSE = "demand_response",
  WORK_ORDER = "work_order",
  CARBON = "carbon",
  SYSTEM = "system",
  PRICE = "price",
}

export enum NotificationSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

@Entity()
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    type: "enum",
    enum: NotificationSeverity,
    default: NotificationSeverity.INFO,
  })
  severity: NotificationSeverity;

  @Column()
  title: string;

  @Column({ type: "text" })
  content: string;

  @Column({ type: "jsonb", nullable: true })
  data: any;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
