import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import NewShipmentForm from "@/components/NewShipmentForm";

export default async function NewShipmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [locations, branches, surcharges] = await Promise.all([
    db.location.findMany({ orderBy: { name: "asc" } }),
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.surcharge.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href="/shipments" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Shipments
        </a>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">New Shipment</h1>
      </div>

      <NewShipmentForm
        locations={locations}
        branches={branches}
        surcharges={surcharges}
        userBranchId={user.branchId}
      />
    </div>
  );
}
