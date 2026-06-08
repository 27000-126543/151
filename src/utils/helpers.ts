import moment from "moment";
import { v4 as uuidv4 } from "uuid";

export const generateId = (): string => {
  return uuidv4();
};

export const formatDate = (date: Date, format: string = "YYYY-MM-DD HH:mm:ss"): string => {
  return moment(date).format(format);
};

export const startOfDay = (date: Date = new Date()): Date => {
  return moment(date).startOf("day").toDate();
};

export const endOfDay = (date: Date = new Date()): Date => {
  return moment(date).endOf("day").toDate();
};

export const startOfMonth = (date: Date = new Date()): Date => {
  return moment(date).startOf("month").toDate();
};

export const endOfMonth = (date: Date = new Date()): Date => {
  return moment(date).endOf("month").toDate();
};

export const addDays = (date: Date, days: number): Date => {
  return moment(date).add(days, "days").toDate();
};

export const diffDays = (date1: Date, date2: Date): number => {
  return moment(date1).diff(moment(date2), "days");
};

export const roundTo = (num: number, decimals: number = 2): number => {
  return Number(Math.round(Number(num + "e" + decimals)) + "e-" + decimals);
};

export const generateOrderNo = (prefix: string = "ORD"): string => {
  return `${prefix}${moment().format("YYYYMMDDHHmmss")}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;
};

export const getTimeSlot = (date: Date = new Date()): string => {
  const hour = date.getHours();
  if (hour >= 0 && hour < 6) return "谷";
  if (hour >= 6 && hour < 10) return "平";
  if (hour >= 10 && hour < 14) return "峰";
  if (hour >= 14 && hour < 18) return "平";
  if (hour >= 18 && hour < 22) return "峰";
  return "谷";
};

export const startOfYesterday = (): Date => {
  return moment().subtract(1, "day").startOf("day").toDate();
};

export const endOfYesterday = (): Date => {
  return moment().subtract(1, "day").endOf("day").toDate();
};

export const getTimePeriod = (): { start: Date; end: Date }[] => {
  const periods: { start: Date; end: Date }[] = [];
  const now = new Date();

  for (let i = 0; i < 24; i++) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i, 59, 59);
    periods.push({ start, end });
  }

  return periods;
};
