import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { RepairSkill } from "./WorkOrder";

export enum TeamStatus {
  IDLE = "idle",
  BUSY = "busy",
  OFF_DUTY = "off_duty",
  MAINTENANCE = "maintenance",
}

@Entity()
export class RepairTeam {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  teamCode: string;

  @Column()
  teamName: string;

  @Column({
    type: "enum",
    enum: TeamStatus,
    default: TeamStatus.IDLE,
  })
  status: TeamStatus;

  @Column({
    type: "enum",
    enum: RepairSkill,
    array: true,
    default: [],
  })
  skills: RepairSkill[];

  @Column({ default: 1 })
  memberCount: number;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  baseLatitude: number;

  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  baseLongitude: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  currentWorkload: number;

  @Column({ type: "text", nullable: true })
  contactInfo: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: "text", nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
