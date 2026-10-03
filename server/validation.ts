import { z } from "zod";
const pct = z.coerce.number().finite().min(0.01).max(100);
const exposure = z.coerce.number().finite().min(0.01).max(1000);
const limits = z.record(z.string().min(1).max(60), pct);
export const scenarioSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().max(500),
    draft: z.boolean(),
    maxHeat: pct,
    warningHeat: pct,
    maxTradeRisk: pct,
    maxPosition: pct,
    maxGross: exposure,
    maxNet: exposure,
    maxMargin: pct,
    minLiquidity: pct,
    dailyLoss: pct,
    weeklyLoss: pct,
    monthlyLoss: pct,
    totalDrawdown: pct,
    sectorLimit: pct,
    sectorLimits: limits,
    assetLimits: limits,
    requireStops: z.boolean(),
    alertEnabled: z.boolean(),
    warningPercent: pct,
  })
  .refine((v) => v.warningHeat < v.maxHeat, {
    path: ["warningHeat"],
    message: "Warning must be below max heat",
  })
  .refine((v) => v.maxTradeRisk <= v.maxHeat, {
    path: ["maxTradeRisk"],
    message: "Trade risk must be below max heat",
  });
