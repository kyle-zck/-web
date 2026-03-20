import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { SubscriptionPlan } from "@/constants/mock-data";

const CONFIG_PATH = path.join(process.cwd(), "data", "app-config.json");

export interface AppConfig {
  brandName: string;
  subscriptionPlans?: SubscriptionPlan[];
}

const DEFAULT_CONFIG: AppConfig = {
  brandName: "ReelShorts",
  subscriptionPlans: [
    { id: "monthly", label: "Monthly VIP", priceUsd: 29.9, durationDays: 30, paymentUrl: "/store?plan=monthly" },
    { id: "weekly", label: "Weekly VIP", priceUsd: 19.99, durationDays: 7, paymentUrl: "/store?plan=weekly" },
    { id: "yearly", label: "Yearly VIP", priceUsd: 199.99, durationDays: 365, paymentUrl: "/store?plan=yearly" }
  ]
};

export async function GET() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const json = JSON.parse(raw) as AppConfig;
    return NextResponse.json({ ...DEFAULT_CONFIG, ...json });
  } catch {
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

