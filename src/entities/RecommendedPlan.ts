import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ElectricityPlan } from "./ElectricityPlan";

export enum StrategyType {
  COST_OPTIMAL = "cost_optimal",
  BALANCED = "balanced",
  ENVIRONMENTAL = "environmental",
}

@Entity()
export class RecommendedPlan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  electricityPlanId: string;

  @ManyToOne(() => ElectricityPlan, (plan) => plan.recommendedPlans)
  @JoinColumn({ name: "electricityPlanId" })
  electricityPlan: ElectricityPlan;

  @Column({
    type: "enum",
    enum: StrategyType,
  })
  strategyType: StrategyType;

  @Column({ type: "jsonb" })
  optimizedSlots: Array<{
    hour: number;
    originalDemand: number;
    optimizedDemand: number;
    shiftedTo?: number;
    cost: number;
    saving: number;
  }>;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  totalCost: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  estimatedSaving: number;

  @Column({ type: "decimal", precision: 5, scale: 2 })
  savingRate: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  carbonReduction: number;

  @Column({ type: "text", nullable: true })
  recommendations: string;

  @Column({ default: false })
  isSelected: boolean;

  @Column({ type: "jsonb", nullable: true })
  analysisData: any;

  @CreateDateColumn()
  createdAt: Date;
}
