import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

export enum CreditType {
  EARNED = "earned",
  PURCHASED = "purchased",
  SOLD = "sold",
  USED = "used",
  EXPIRED = "expired",
}

export enum CreditStatus {
  AVAILABLE = "available",
  LOCKED = "locked",
  USED = "used",
  EXPIRED = "expired",
}

@Entity()
export class CarbonCredit {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.carbonCredits)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({
    type: "enum",
    enum: CreditType,
  })
  type: CreditType;

  @Column({
    type: "enum",
    enum: CreditStatus,
    default: CreditStatus.AVAILABLE,
  })
  status: CreditStatus;

  @Column({ type: "decimal", precision: 15, scale: 4 })
  amount: number;

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  balanceBefore: number;

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  balanceAfter: number;

  @Column({ type: "date", nullable: true })
  validFrom: Date;

  @Column({ type: "date", nullable: true })
  validTo: Date;

  @Column({ length: 100, nullable: true })
  projectId: string;

  @Column({ length: 200, nullable: true })
  projectName: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "jsonb", nullable: true })
  metadata: any;

  @Column({ nullable: true })
  relatedTransactionId: string;

  @CreateDateColumn()
  createdAt: Date;
}
