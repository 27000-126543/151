import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Bill } from "./Bill";
import { TimeSlot } from "./ElectricityPrice";

@Entity()
export class BillDetail {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  billId: string;

  @ManyToOne(() => Bill, (bill) => bill.details)
  @JoinColumn({ name: "billId" })
  bill: Bill;

  @Column({
    type: "enum",
    enum: TimeSlot,
  })
  timeSlot: TimeSlot;

  @Column({ type: "timestamp" })
  startTime: Date;

  @Column({ type: "timestamp" })
  endTime: Date;

  @Column({ type: "decimal", precision: 15, scale: 4 })
  usage: number;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  unitPrice: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;
}
