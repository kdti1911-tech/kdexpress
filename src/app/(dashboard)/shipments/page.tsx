import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { formatCurrency, formatDate, SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLORS } from "@/lib/utils";

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
        <Link
          href="/shipments/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Shipment
        </Link>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>
          <div className="flex gap-2 flex-wrap">
            <Link
              href={buildUrl({ status: undefined, page: "1" })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                !status ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </Link>
            {statuses.map((s) => (
              <Link
                key={s}
                href={buildUrl({ status: s, page: "1" })}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  status === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {SHIPMENT_STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tracking #
                </th>
                {!isClient && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Shipper
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Receiver
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Weight
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shipments.length === 0 ? (
                <tr>
                  <td
                    colSpan={isClient ? 6 : 7}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    No shipments found.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="font-mono text-blue-600 hover:underline"
                      >
                        {s.trackingNumber}
                      </Link>
                    </td>
                    {!isClient && (
                      <td className="px-4 py-3 text-gray-600">
                        {s.sender ? (
                          <span>
                            {s.sender.name}
                            {s.sender.userCode && (
                              <span className="ml-1 font-mono text-xs text-gray-400">
                                [{s.sender.userCode}]
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{s.shipperName}</div>
                      <div className="text-xs text-gray-400">
                        {[s.shipperCity, s.shipperCountry].filter(Boolean).join(", ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{s.receiverName}</div>
                      <div className="text-xs text-gray-400">
                        {[s.receiverCity, s.receiverCountry].filter(Boolean).join(", ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          SHIPMENT_STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {SHIPMENT_STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {s.totalWeight.toFixed(2)} kg
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(s.totalAmount, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(s.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
