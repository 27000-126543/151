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
import { RecommendedPlan } from "./RecommendedPlan";

export enum PlanStatus {
  PENDING = "pending",
  RECOMMENDED = "recommended",
  APPROVED = "approved",
  REJECTED = "rejected",
  EXECUTING = "executing",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

@Entity()
export class ElectricityPlan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.electricityPlans)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "timestamp" })
  planDate: Date;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  totalDemand: number;

  @Column({ type: "jsonb" })
  timeSlots: Array<{
    hour: number;
    demand: number;
    flexible: boolean;
  }>;

  @Column({ type: "jsonb", nullable: true })
  preferences: {
    maxCost?: number;
    priority?: "cost" | "reliability" | "environmental";
    avoidHours?: number[];
  };

  @Column({
    type: "enum",
    enum: PlanStatus,
    default: PlanStatus.PENDING,
  })
  status: PlanStatus;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  estimatedCost: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  actualCost: number;

  @Column({ type: "text", nullable: true })
  remark: string;

  @OneToMany(() => RecommendedPlan, (rec) => rec.electricityPlan)
  recommendedPlans: RecommendedPlan[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
