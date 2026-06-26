import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  PLANNING:   "bg-gray-100 text-gray-600",
  LOADING:    "bg-yellow-100 text-yellow-700",
  SEALED:     "bg-blue-100 text-blue-700",
  DISPATCHED: "bg-purple-100 text-purple-700",
  IN_TRANSIT: "bg-orange-100 text-orange-700",
  ARRIVED:    "bg-green-100 text-green-700",
  CLOSED:     "bg-gray-100 text-gray-400",
};

const TRANSPORT_ICONS: Record<string, string> = {
  AIR: "✈",
  SEA: "🚢",
  TRUCK: "🚛",
  AIR_CANADA: "✈",
  FAST_TRACK: "⚡",
  LOCAL_MOVING: "📦",
};

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function ManifestsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "VIEW_ALL_SHIPMENTS")) redirect("/dashboard");

  const params = await searchParams;
  const status = params.status ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const limit = 20;
  const canCreate = can(user.role, "MANAGE_BRANCHES");

  const where = status ? { status: status as never } : {};

  const [manifests, total] = await Promise.all([
    db.manifest.findMany({
      where,
      include: {
        originBranch: { select: { name: true, code: true } },
        destBranch:   { select: { name: true, code: true } },
        pallets: {
          select: {
            _count: { select: { packages: true } },
            packages: { select: { package: { select: { weight: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.manifest.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const statuses = ["PLANNING", "LOADING", "SEALED", "DISPATCHED", "IN_TRANSIT", "ARRIVED", "CLOSED"];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manifests</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} lô hàng</p>
        </div>
        {canCreate && (
          <Link href="/manifests/new" className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800">
            + Tạo Lô Hàng
          </Link>
        )}
      </div>

      {/* Status filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex gap-2 flex-wrap">
          <Link href="/manifests" className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!status ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            Tất cả
          </Link>
          {statuses.map((s) => (
            <Link key={s} href={`/manifests?status=${s}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${status === s ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mã Lô</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tuyến</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vận Chuyển</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pallets</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kiện</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">KG</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ngày Đi</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {manifests.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Chưa có lô hàng nào.</td></tr>
            ) : manifests.map((m) => {
              const totalPieces = m.pallets.reduce((s, p) => s + p._count.packages, 0);
              const totalWeight = m.pallets.reduce((s, p) => s + p.packages.reduce((ws, pp) => ws + (pp.package.weight ?? 0), 0), 0);
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/manifests/${m.id}`} className="font-mono font-semibold text-green-700 hover:underline">
                      {m.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="text-xs">{m.originBranch?.name ?? "—"}</div>
                    <div className="text-xs text-gray-400">→ {m.destBranch?.name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-base">{TRANSPORT_ICONS[m.transportMode] ?? ""}</span>
                    <span className="ml-1 text-xs text-gray-500">{m.transportMode}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-gray-900">{m.pallets.length}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{totalPieces}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{totalWeight.toFixed(1)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {m.departureDate ? new Date(m.departureDate).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">Trang {page} / {totalPages}</div>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/manifests?status=${status}&page=${page - 1}`} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">← Trước</Link>}
              {page < totalPages && <Link href={`/manifests?status=${status}&page=${page + 1}`} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Sau →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
