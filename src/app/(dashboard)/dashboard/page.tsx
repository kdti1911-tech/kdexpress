import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, SHIPMENT_STATUS_LABELS } from "@/lib/utils";
import Link from "next/link";

async function getStats(userId: string, role: string) {
  const isClient = ["CLIENT", "AGENT", "AGENT_VN"].includes(role);
  const where = isClient ? { senderId: userId } : {};

  const [total, pending, inTransit, delivered, revenue] = await Promise.all([
    db.shipment.count({ where }),
    db.shipment.count({ where: { ...where, status: "PENDING" } }),
    db.shipment.count({ where: { ...where, status: "IN_TRANSIT" } }),
    db.shipment.count({ where: { ...where, status: "DELIVERED" } }),
    db.shipment.aggregate({ where, _sum: { totalAmount: true } }),
  ]);

  return { total, pending, inTransit, delivered, revenue: revenue._sum.totalAmount ?? 0 };
}

async function getRecentShipments(userId: string, role: string) {
  const isClient = ["CLIENT", "AGENT", "AGENT_VN"].includes(role);
  const where = isClient ? { senderId: userId } : {};

  return db.shipment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      trackingNumber: true,
      status: true,
      shipperName: true,
      receiverName: true,
      receiverCountry: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
    },
  });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [stats, recent] = await Promise.all([
    getStats(user.id, user.role),
    getRecentShipments(user.id, user.role),
  ]);

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    PICKED_UP: "bg-indigo-100 text-indigo-700",
    IN_TRANSIT: "bg-purple-100 text-purple-700",
    ARRIVED_ORIGIN: "bg-cyan-100 text-cyan-700",
    CUSTOMS_CLEARANCE: "bg-orange-100 text-orange-700",
    ARRIVED_DESTINATION: "bg-teal-100 text-teal-700",
    OUT_FOR_DELIVERY: "bg-sky-100 text-sky-700",
    DELIVERED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    RETURNED: "bg-gray-100 text-gray-700",
    LOST: "bg-red-200 text-red-900",
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/shipments/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Shipment
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Shipments" value={stats.total.toString()} color="blue" />
        <StatCard label="Pending" value={stats.pending.toString()} color="yellow" />
        <StatCard label="In Transit" value={stats.inTransit.toString()} color="purple" />
        <StatCard label="Delivered" value={stats.delivered.toString()} color="green" />
      </div>

      {!["CLIENT", "AGENT", "AGENT_VN"].includes(user.role) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="text-sm text-gray-500">Total Revenue</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(stats.revenue)}
          </div>
        </div>
      )}

      {/* Recent Shipments */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Shipments</h2>
          <Link href="/shipments" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recent.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400 text-sm">
              No shipments yet.{" "}
              <Link href="/shipments/new" className="text-blue-600 hover:underline">
                Create your first shipment
              </Link>
            </div>
          ) : (
            recent.map((s) => (
              <Link
                key={s.id}
                href={`/shipments/${s.id}`}
                className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="font-mono text-sm text-blue-600 w-36 flex-shrink-0">
                  {s.trackingNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">{s.shipperName} → {s.receiverName}</div>
                  <div className="text-xs text-gray-400">{s.receiverCountry}</div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    statusColors[s.status] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {SHIPMENT_STATUS_LABELS[s.status] ?? s.status}
                </span>
                <div className="text-sm font-medium text-gray-900 w-24 text-right flex-shrink-0">
                  {formatCurrency(s.totalAmount, s.currency)}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "blue" | "yellow" | "purple" | "green";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    yellow: "bg-yellow-50 text-yellow-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-green-50 text-green-700",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-sm text-gray-500 mb-2">{label}</div>
      <div className={`text-3xl font-bold ${colors[color].split(" ")[1]}`}>{value}</div>
    </div>
  );
}
