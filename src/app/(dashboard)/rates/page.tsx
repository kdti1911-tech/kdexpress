import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import RatesNav from "./RatesNav";

export default async function RatesPage() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    redirect("/dashboard");
  }

  const zones = await db.rateZone.findMany({
    where: { isActive: true },
    include: {
      origin: true,
      destinations: { include: { location: true } },
      rates: {
        include: { deliveryType: true },
        orderBy: { weightCost: "asc" },
      },
    },
    orderBy: { label: "asc" },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rates</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage pricing by zone, customer, and cargo type</p>
      </div>

      <RatesNav active="zones" />

      <div className="space-y-5 mt-5">
        {zones.map((zone) => (
          <div key={zone.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div className="font-semibold text-gray-900">{zone.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Origin: {zone.origin.name} → Destinations:{" "}
                {zone.destinations.map((d) => d.location.name).join(", ")}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400">Service</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400">Delivery</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Rate/kg</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Min Weight</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Max Weight</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {zone.rates.map((rate) => (
                  <tr key={rate.id}>
                    <td className="px-5 py-3 text-gray-900">
                      {rate.brand && <span className="font-medium">{rate.brand}</span>}
                      {rate.service && <span className="text-gray-500 ml-1">· {rate.service}</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{rate.deliveryType.title}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(rate.weightCost)}/kg
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">{rate.minWeight} kg</td>
                    <td className="px-5 py-3 text-right text-gray-500">
                      {rate.maxWeight >= 9000 ? "Unlimited" : `${rate.maxWeight} kg`}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rate.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {rate.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

