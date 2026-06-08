import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity()
@Index(["reportDate", "region"], { unique: true })
export class DailyReport {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "date" })
  @Index()
  reportDate: Date;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  peakLoad: number;

  @Column({ type: "timestamp", nullable: true })
  peakLoadTime: Date;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  valleyLoad: number;

  @Column({ type: "timestamp", nullable: true })
  valleyLoadTime: Date;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  averageLoad: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  totalConsumption: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  totalGeneration: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  renewableGeneration: number;

  @Column({ type: "decimal", precision: 10, scale: 4, default: 0 })
  renewableRatio: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  pvGeneration: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  windGeneration: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  storageCharge: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  storageDischarge: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  gridImport: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  gridExport: number;

  @Column({ type: "int", default: 0 })
  demandResponseCount: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  demandResponseLoadReduction: number;

  @Column({ type: "int", default: 0 })
  participationCount: number;

  @Column({ type: "decimal", precision: 10, scale: 4, default: 0 })
  participationRate: number;

  @Column({ type: "decimal", precision: 15, scale: 2, default: 0 })
  totalIncentive: number;

  @Column({ type: "int", default: 0 })
  totalDevices: number;

  @Column({ type: "int", default: 0 })
  normalDevices: number;

  @Column({ type: "int", default: 0 })
  warningDevices: number;

  @Column({ type: "int", default: 0 })
  faultDevices: number;

  @Column({ type: "int", default: 0 })
  offlineDevices: number;

  @Column({ type: "decimal", precision: 10, scale: 4, default: 0 })
  deviceFaultRate: number;

  @Column({ type: "int", default: 0 })
  newWorkOrders: number;

  @Column({ type: "int", default: 0 })
  completedWorkOrders: number;

  @Column({ type: "int", default: 0 })
  activeAlerts: number;

  @Column({ type: "int", default: 0 })
  criticalAlerts: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  totalTradingVolume: number;

  @Column({ type: "decimal", precision: 15, scale: 2, default: 0 })
  totalTradingAmount: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  totalCarbonEmission: number;

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  carbonReduction: number;

  @Column({ type: "jsonb", nullable: true })
  hourlyLoadData: number[];

  @Column({ type: "jsonb", nullable: true })
  hourlyPriceData: number[];

  @Column({ type: "jsonb", nullable: true })
  additionalMetrics: any;

  @Column({ type: "text", nullable: true })
  summary: string;

  @Column({ type: "text", nullable: true })
  recommendations: string;

  @CreateDateColumn()
  createdAt: Date;
}
