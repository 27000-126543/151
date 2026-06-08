import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export enum EnergySource {
  COAL = "coal",
  NATURAL_GAS = "natural_gas",
  OIL = "oil",
  NUCLEAR = "nuclear",
  HYDRO = "hydro",
  WIND = "wind",
  SOLAR = "solar",
  BIOMASS = "biomass",
  GEOTHERMAL = "geothermal",
}

export enum EmissionScope {
  SCOPE1 = "scope1",
  SCOPE2 = "scope2",
  SCOPE3 = "scope3",
}

@Entity()
@Index(["userId", "emissionDate"])
export class CarbonEmission {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column({
    type: "enum",
    enum: EnergySource,
  })
  energySource: EnergySource;

  @Column({
    type: "enum",
    enum: EmissionScope,
    default: EmissionScope.SCOPE2,
  })
  scope: EmissionScope;

  @Column({ type: "date" })
  @Index()
  emissionDate: Date;

  @Column({ type: "decimal", precision: 15, scale: 4 })
  energyConsumption: number;

  @Column({ type: "decimal", precision: 12, scale: 6 })
  emissionFactor: number;

  @Column({ type: "decimal", precision: 15, scale: 4 })
  emissionAmount: number;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "jsonb", nullable: true })
  calculationData: any;

  @CreateDateColumn()
  createdAt: Date;
}
