"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

const NEXT_STATUS: Record<string, { label: string; status: string; color: string } | null> = {
  PLANNING:   { label: "Bắt đầu Đóng Hàng →", status: "LOADING",    color: "bg-yellow-600 hover:bg-yellow-700" },
  LOADING:    { label: "Seal Lô →",            status: "SEALED",     color: "bg-blue-600 hover:bg-blue-700" },
  SEALED:     { label: "Dispatch →",           status: "DISPATCHED", color: "bg-purple-600 hover:bg-purple-700" },
  DISPATCHED: { label: "Đang Vận Chuyển →",   status: "IN_TRANSIT", color: "bg-orange-600 hover:bg-orange-700" },
  IN_TRANSIT: { label: "Đã Đến →",            status: "ARRIVED",    color: "bg-green-600 hover:bg-green-700" },
  ARRIVED:    { label: "Đóng Lô →",           status: "CLOSED",     color: "bg-gray-600 hover:bg-gray-700" },
  CLOSED:     null,
};

const TRANSPORT_ICONS: Record<string, string> = {
  AIR: "✈", SEA: "🚢", TRUCK: "🚛", AIR_CANADA: "✈", FAST_TRACK: "⚡", LOCAL_MOVING: "📦",
};

type Package = {
  palletId: string; packageId: string; addedAt: string;
  addedBy: { name: string } | null;
  package: {
    id: string; trackingNumber: string | null; sequence: number; weight: number; description: string | null;
    shipment: { id: string; trackingNumber: string; shipperName: string; receiverName: string; receiverCountry: string };
  };
};

type Pallet = {
  id: string; code: string; status: string; destination: string | null; notes: string | null; sealedAt: string | null;
  packages: Package[];
};

type Manifest = {
  id: string; code: string; status: string; transportMode: string; notes: string | null;
  departureDate: string | null; arrivalDate: string | null;
  originBranch: { name: string } | null;
  destBranch: { name: string } | null;
  createdBy: { name: string } | null;
  pallets: Pallet[];
};

type Branch = { id: string; name: string; code: string };

interface Props {
  manifest: Manifest;
  branches: Branch[];
  canManage: boolean;
  canUpdateStatus: boolean;
  totalPieces: number;
  totalWeight: number;
}

export default function ManifestDetailClient({ manifest: initialManifest, canManage, canUpdateStatus, totalPieces, totalWeight }: Props) {
  const router = useRouter();
  const [manifest, setManifest] = useState(initialManifest);
  const [statusLoading, setStatusLoading] = useState(false);
  const [addingPallet, setAddingPallet] = useState(false);
  const [newPalletDest, setNewPalletDest] = useState(manifest.destBranch?.name ?? "");
  const [error, setError] = useState("");
  const [deletingManifest, setDeletingManifest] = useState(false);
  const [deletingPallet, setDeletingPallet] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  async function advanceStatus() {
    const next = NEXT_STATUS[manifest.status];
    if (!next) return;
    if (!confirm(`Chuyển lô hàng sang "${next.status}"? Trạng thái tất cả kiện sẽ được cập nhật tự động.`)) return;
    setStatusLoading(true);
    const res = await fetch(`/api/manifests/${manifest.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next.status }),
    });
    const data = await res.json();
    setStatusLoading(false);
    if (data.success) { setManifest((prev) => ({ ...prev, status: next.status })); refresh(); }
    else setError(data.error ?? "Lỗi");
  }

  async function addPallet() {
    setAddingPallet(true);
    const res = await fetch(`/api/manifests/${manifest.id}/pallets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: newPalletDest }),
    });
    const data = await res.json();
    setAddingPallet(false);
    if (data.success) { refresh(); }
    else setError(data.error ?? "Lỗi");
  }

  async function deleteManifest() {
    if (!confirm(`Xoá lô hàng ${manifest.code}? Tất cả pallets và dữ liệu liên quan sẽ bị xoá vĩnh viễn.`)) return;
    setDeletingManifest(true);
    const res = await fetch(`/api/manifests/${manifest.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingManifest(false);
    if (data.success) { router.push("/manifests"); router.refresh(); }
    else setError(data.error ?? "Lỗi xoá manifest");
  }

  async function deletePallet(palletId: string, palletCode: string) {
    if (!confirm(`Xoá pallet ${palletCode}? Tất cả kiện trong pallet sẽ được bỏ ra khỏi pallet.`)) return;
    setDeletingPallet(palletId);
    const res = await fetch(`/api/manifests/${manifest.id}/pallets/${palletId}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingPallet(null);
    if (data.success) { refresh(); }
    else setError(data.error ?? "Lỗi xoá pallet");
  }

  const next = NEXT_STATUS[manifest.status];
  const canAddPallets = canManage && ["PLANNING", "LOADING"].includes(manifest.status);
  const pieces = totalPieces;
  const weight = totalWeight;

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Stats + status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{manifest.pallets.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Pallets</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{pieces}</div>
          <div className="text-xs text-gray-500 mt-0.5">Kiện</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{weight.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-0.5">kg</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-lg font-bold">{TRANSPORT_ICONS[manifest.transportMode] ?? ""}</div>
          <div className="text-xs text-gray-500 mt-0.5">{manifest.transportMode}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[manifest.status]}`}>
            {manifest.status}
          </span>
          <div className="text-xs text-gray-500 mt-1">Status</div>
        </div>
      </div>

      {/* Info bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-6 text-sm">
        <div><span className="text-gray-400 text-xs uppercase">Từ</span><div className="font-medium">{manifest.originBranch?.name ?? "—"}</div></div>
        <div><span className="text-gray-400 text-xs uppercase">Đến</span><div className="font-medium">{manifest.destBranch?.name ?? "—"}</div></div>
        <div><span className="text-gray-400 text-xs uppercase">Ngày Đi</span><div className="font-medium">{manifest.departureDate ? new Date(manifest.departureDate).toLocaleDateString("vi-VN") : "—"}</div></div>
        <div><span className="text-gray-400 text-xs uppercase">Dự Kiến Đến</span><div className="font-medium">{manifest.arrivalDate ? new Date(manifest.arrivalDate).toLocaleDateString("vi-VN") : "—"}</div></div>
        {manifest.notes && <div className="flex-1"><span className="text-gray-400 text-xs uppercase">Ghi Chú</span><div>{manifest.notes}</div></div>}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {canUpdateStatus && next && (
            <button onClick={advanceStatus} disabled={statusLoading}
              className={`px-5 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${next.color}`}>
              {statusLoading ? "Đang cập nhật..." : next.label}
            </button>
          )}
        </div>
        {canManage && (
          <button onClick={deleteManifest} disabled={deletingManifest}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
            {deletingManifest ? "Đang xoá..." : "Xoá Lô Hàng"}
          </button>
        )}
      </div>

      {/* Add Pallet */}
      {canAddPallets && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Thêm Pallet</h3>
          <div className="flex gap-3">
            <input
              value={newPalletDest}
              onChange={(e) => setNewPalletDest(e.target.value)}
              placeholder="Destination (e.g. HCM, HN...)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <button onClick={addPallet} disabled={addingPallet}
              className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 whitespace-nowrap">
              {addingPallet ? "Đang thêm..." : "+ Thêm Pallet"}
            </button>
          </div>
        </div>
      )}

      {/* Pallets */}
      <div className="space-y-4">
        {manifest.pallets.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            Chưa có pallet nào. Thêm pallet để bắt đầu đóng hàng.
          </div>
        ) : manifest.pallets.map((pallet) => {
          const palletWeight = pallet.packages.reduce((s, pp) => s + (pp.package.weight ?? 0), 0);
          return (
            <div key={pallet.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Pallet header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-gray-900">{pallet.code}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pallet.status === "SEALED" ? "bg-blue-100 text-blue-700" : "bg-green-50 text-green-700"}`}>
                    {pallet.status}
                  </span>
                  {pallet.destination && <span className="text-xs text-gray-500">→ {pallet.destination}</span>}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{pallet.packages.length} kiện</span>
                  <span>{palletWeight.toFixed(1)} kg</span>
                  {canUpdateStatus && ["PLANNING", "LOADING"].includes(manifest.status) && (
                    <Link href={`/manifests/${manifest.id}/pallets/${pallet.id}`}
                      className="px-3 py-1 bg-green-700 text-white rounded text-xs font-medium hover:bg-green-800">
                      + Scan Kiện
                    </Link>
                  )}
                  {canManage && (
                    <button
                      onClick={() => deletePallet(pallet.id, pallet.code)}
                      disabled={deletingPallet === pallet.id}
                      className="px-3 py-1 text-red-500 border border-red-200 rounded text-xs font-medium hover:bg-red-50 disabled:opacity-40"
                    >
                      {deletingPallet === pallet.id ? "..." : "Xoá"}
                    </button>
                  )}
                </div>
              </div>

              {/* Package list */}
              {pallet.packages.length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-400 text-center">Chưa có kiện nào trong pallet này.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="text-left px-4 py-2">Mã Kiện</th>
                      <th className="text-left px-4 py-2">Shipment</th>
                      <th className="text-left px-4 py-2">Người Gửi</th>
                      <th className="text-left px-4 py-2">Người Nhận</th>
                      <th className="text-right px-4 py-2">KG</th>
                      <th className="text-left px-4 py-2">Mô Tả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pallet.packages.map((pp) => (
                      <tr key={pp.packageId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-xs text-green-700">
                          {(pp.package.trackingNumber ?? "").replace(/-/g, "")}
                        </td>
                        <td className="px-4 py-2">
                          <Link href={`/shipments/${pp.package.shipment.id}`}
                            className="font-mono text-xs text-gray-600 hover:text-green-700">
                            {pp.package.shipment.trackingNumber.replace(/-/g, "")}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-gray-700 text-xs">{pp.package.shipment.shipperName}</td>
                        <td className="px-4 py-2 text-gray-700 text-xs">{pp.package.shipment.receiverName}</td>
                        <td className="px-4 py-2 text-right text-gray-900 text-xs">{pp.package.weight.toFixed(2)}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{pp.package.description ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
