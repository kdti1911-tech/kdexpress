import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { SHIPMENT_STATUS_LABELS } from "@/lib/utils";
import { can } from "@/lib/permissions";
import ShipmentsClient from "./ShipmentsClient";

interface Props {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}

export default async function ShipmentsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const limit = 20;

  const isClient = ["CLIENT", "AGENT", "AGENT_VN"].includes(user.role);
  const canManage = can(user.role, "MANAGE_BRANCHES");

  const where = {
    ...(isClient ? { senderId: user.id } : {}),
    ...(status ? { status: status as never } : {}),
    ...(search
      ? {
          OR: [
            { trackingNumber: { contains: search, mode: "insensitive" as const } },
            { shipperName: { contains: search, mode: "insensitive" as const } },
            { receiverName: { contains: search, mode: "insensitive" as const } },
            { shipperPhone: { contains: search, mode: "insensitive" as const } },
            { receiverPhone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [shipments, total] = await Promise.all([
    db.shipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        paymentStatus: true,
        transportMode: true,
        paymentMethod: true,
        hazardType: true,
        shipmentCategory: true,
        shipperName: true,
        shipperCity: true,
        shipperCountry: true,
        receiverName: true,
        receiverCity: true,
        receiverCountry: true,
        totalWeight: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        expectedDelivery: true,
        sender: { select: { id: true, name: true, userCode: true } },
      },
    }),
    db.shipment.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const statuses = [
    "PENDING", "CONFIRMED", "PICKED_UP", "IN_TRANSIT",
    "ARRIVED_ORIGIN", "CUSTOMS_CLEARANCE", "ARRIVED_DESTINATION",
    "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
  ];

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (search && !("search" in overrides)) p.set("search", search);
    if (status && !("status" in overrides)) p.set("status", status);
    if (page > 1 && !("page" in overrides)) p.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
    }
    const str = p.toString();
    return `/shipments${str ? "?" + str : ""}`;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/shipments/export" className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Export CSV
          </a>
          <Link href="/shipments/new" className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Shipment
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <form className="flex-1 min-w-[200px]">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search tracking #, name, phone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </form>
          <div className="flex gap-2 flex-wrap">
            <Link href={buildUrl({ status: undefined, page: "1" })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${!status ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All
            </Link>
            {statuses.map(s => (
              <Link key={s} href={buildUrl({ status: s, page: "1" })}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${status === s ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {SHIPMENT_STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <ShipmentsClient shipments={shipments} isClient={isClient} canManage={canManage} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 mt-2">
          <div className="text-sm text-gray-500">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 bg-white">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 bg-white">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
