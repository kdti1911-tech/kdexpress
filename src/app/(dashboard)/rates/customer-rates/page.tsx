import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import RatesNav from "../RatesNav";
import CustomerRatesClient from "./CustomerRatesClient";

export default async function CustomerRatesPage() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    redirect("/dashboard");
  }

  const customers = await db.user.findMany({
    where: {
      isActive: true,
      role: { in: ["AGENT", "AGENT_VN", "CLIENT"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      userCode: true,
      role: true,
      userRate: {
        select: { ratePerKg: true, note: true, isActive: true },
      },
      _count: { select: { shipmentsSender: true } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rates</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage pricing by zone, customer, and cargo type</p>
      </div>

      <RatesNav active="customer-rates" />

      <div className="mt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Customer &amp; Agent Rates</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Set a custom rate per kg for each agent or customer. Overrides the default rate in shipment creation.
              Leave unset to enter rate manually per shipment.
            </p>
          </div>
          <div className="text-sm text-gray-400">
            {customers.filter(c => c.userRate?.isActive).length} / {customers.length} with custom rates
          </div>
        </div>

        <CustomerRatesClient
          customers={customers}
          roleLabels={ROLE_LABELS}
          roleColors={ROLE_COLORS}
        />
      </div>
    </div>
  );
}
