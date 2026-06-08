import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum ForecastType {
  SHORT_TERM = "short_term",
  MEDIUM_TERM = "medium_term",
  LONG_TERM = "long_term",
  DAY_AHEAD = "day_ahead",
}

@Entity()
@Index(["forecastDate", "region", "forecastType"], { unique: true })
export class LoadForecast {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: ForecastType,
    default: ForecastType.DAY_AHEAD,
  })
  forecastType: ForecastType;

  @Column({ type: "date" })
  @Index()
  forecastDate: Date;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ type: "jsonb" })
  hourlyForecast: number[];

  @Column({ type: "jsonb", nullable: true })
  hourlyConfidence: number[];

  @Column({ type: "decimal", precision: 15, scale: 4 })
  totalForecast: number;

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  peakForecast: number;

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  valleyForecast: number;

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  actualLoad: number;

  @Column({ type: "jsonb", nullable: true })
  hourlyActual: number[];

  @Column({ type: "decimal", precision: 10, scale: 4, nullable: true })
  accuracy: number;

  @Column({ type: "decimal", precision: 10, scale: 4, nullable: true })
  mape: number;

  @Column({ type: "jsonb", nullable: true })
  modelInputs: any;

  @Column({ type: "text", nullable: true })
  modelVersion: string;

  @Column({ type: "text", nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
