import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum PriceType {
  BUY = "buy",
  SELL = "sell",
  GRID = "grid",
}

export enum TimeSlot {
  PEAK = "peak",
  FLAT = "flat",
  VALLEY = "valley",
}

@Entity()
export class ElectricityPrice {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: PriceType,
  })
  priceType: PriceType;

  @Column({
    type: "enum",
    enum: TimeSlot,
  })
  timeSlot: TimeSlot;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  price: number;

  @Column({ type: "timestamp" })
  startTime: Date;

  @Column({ type: "timestamp" })
  endTime: Date;

  @Column({ type: "decimal", precision: 10, scale: 4, nullable: true })
  forecastPrice: number;

  @Column({ length: 50, nullable: true })
  region: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: "text", nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
