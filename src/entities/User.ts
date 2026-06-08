import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { ElectricityPlan } from "./ElectricityPlan";
import { Bill } from "./Bill";
import { DemandResponseTask } from "./DemandResponseTask";
import { Device } from "./Device";
import { CarbonCredit } from "./CarbonCredit";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  ENTERPRISE = "enterprise",
  TRADER = "trader",
  OPERATOR = "operator",
  MAINTENANCE = "maintenance",
  COLLECTOR = "collector",
}

export enum UserType {
  RESIDENTIAL = "residential",
  COMMERCIAL = "commercial",
  INDUSTRIAL = "industrial",
}

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  realName: string;

  @Column({ unique: true })
  phone: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: "enum",
    enum: UserType,
    default: UserType.RESIDENTIAL,
  })
  userType: UserType;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  maxInterruptibleLoad: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  currentLoad: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  carbonCredit: number;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ length: 200, nullable: true })
  address: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  demandResponseEnabled: boolean;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0.5 })
  demandResponsePriority: number;

  @OneToMany(() => ElectricityPlan, (plan) => plan.user)
  electricityPlans: ElectricityPlan[];

  @OneToMany(() => Bill, (bill) => bill.user)
  bills: Bill[];

  @OneToMany(() => DemandResponseTask, (task) => task.user)
  demandResponseTasks: DemandResponseTask[];

  @OneToMany(() => Device, (device) => device.user)
  devices: Device[];

  @OneToMany(() => CarbonCredit, (credit) => credit.user)
  carbonCredits: CarbonCredit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
