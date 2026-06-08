import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

const dbType = (process.env.DB_TYPE as any) || "postgres";

const baseConfig: any = {
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV === "development",
  entities: [__dirname + "/../entities/**/*.{ts,js}"],
  migrations: [__dirname + "/../migrations/**/*.{ts,js}"],
  subscribers: [__dirname + "/../subscribers/**/*.{ts,js}"],
};

let dataSourceConfig: any;

if (dbType === "sqlite") {
  dataSourceConfig = {
    type: "sqlite",
    database: process.env.DB_DATABASE || "./smart_power.db",
    ...baseConfig,
  };
} else {
  dataSourceConfig = {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_DATABASE || "smart_power",
    ...baseConfig,
  };
}

export const AppDataSource = new DataSource(dataSourceConfig);
