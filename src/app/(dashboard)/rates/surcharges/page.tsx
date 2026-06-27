import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import RatesNav from "../RatesNav";
import SurchargesClient from "./SurchargesClient";

const HAZARD_LABELS: Record<string, string> = {
  NONE: "None",
  BATTERY_B: "Battery (B)",
  BATTERY_BHV: "Battery HV",
  FRAGILE: "Fragile",
  MAGNETIC: "Magnetic",
  LIQUID: "Liquid",
  RESCUE: "Relief Goods",
};

export default async function SurchargesPage() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    redirect("/dashboard");
  }

  const surcharges = await db.surcharge.findMany({
    orderBy: [{ sortOrder: "asc" }, { item: "asc" }],
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rates</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage pricing by zone, customer, and cargo type</p>
      </div>

      <RatesNav active="surcharges" />

      <div className="mt-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Surcharges</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Additional fees applied to shipments. Tag a surcharge with a hazard type to auto-apply it when that cargo type is selected.
          </p>
        </div>
        <SurchargesClient surcharges={surcharges} hazardLabels={HAZARD_LABELS} />
      </div>
    </div>
  );
}
