"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLORS } from "@/lib/utils";

type Shipment = {
  id: string;
  trackingNumber: string;
  status: string;
  paymentStatus: string;
  transportMode: string | null;
  paymentMethod: string | null;
  hazardType: string | null;
  shipmentCategory: string | null;
  shipperName: string;
  shipperCity: string | null;
  shipperCountry: string;
  receiverName: string;
  receiverCity: string | null;
  receiverCountry: string;
  totalWeight: number;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  expectedDelivery: Date | null;
  sender: { id: string; name: string; userCode: string | null } | null;
};

type Manifest = {
  id: string;
  manifestNumber: string;
  status: string;
  pallets: { id: string; palletNumber: string; status: string }[];
};

type UserResult = { id: string; name: string; email: string; userCode: string | null };

const MODE_LABELS: Record<string, string> = {
  AIR: "AIR", SEA: "SEA", TRUCK: "TRUCK",
  LOCAL_MOVING: "MOVING", AIR_CANADA: "AIR CA", FAST_TRACK: "FAST",
};
const MODE_COLORS: Record<string, string> = {
  AIR: "bg-blue-100 text-blue-700", SEA: "bg-cyan-100 text-cyan-700",
  TRUCK: "bg-amber-100 text-amber-700", LOCAL_MOVING: "bg-purple-100 text-purple-700",
  AIR_CANADA: "bg-red-100 text-red-700", FAST_TRACK: "bg-orange-100 text-orange-700",
};
const PAY_COLORS: Record<string, string> = {
  PAID_OK2SHIP: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  PAY_IN_VIETNAM: "bg-blue-100 text-blue-700",
  PAY_IN_CANADA: "bg-blue-100 text-blue-700",
};

export default function ShipmentsClient({
  shipments,
  isClient,
  canManage,
}: {
  shipments: Shipment[];
  isClient: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<"delete" | "assign" | "manifest" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Assign customer state
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<UserResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<UserResult | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manifest state
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [manifestId, setManifestId] = useState("");
  const [palletId, setPalletId] = useState("");
  const [loadingManifests, setLoadingManifests] = useState(false);

  const allIds = useMemo(() => shipments.map(s => s.id), [shipments]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }
  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function openModal(m: "delete" | "assign" | "manifest") {
    setModal(m);
    setError("");
    if (m === "assign") { setCustomerQuery(""); setCustomerResults([]); setSelectedCustomer(null); }
    if (m === "manifest") {
      setManifestId(""); setPalletId("");
      loadManifests();
    }
  }
  function closeModal() { setModal(null); setError(""); }

  // Customer search with debounce
  useEffect(() => {
    if (!customerQuery.trim() || customerQuery.length < 2) { setCustomerResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(customerQuery)}`);
        const data = await res.json();
        if (data.success) setCustomerResults(data.data ?? []);
      } catch { /* ignore */ }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [customerQuery]);

  async function loadManifests() {
    setLoadingManifests(true);
    try {
      const res = await fetch("/api/manifests?status=PLANNING,LOADING&limit=50");
      const data = await res.json();
      if (data.success) setManifests(data.data?.items ?? []);
    } catch { /* ignore */ }
    finally { setLoadingManifests(false); }
  }

  const selectedManifest = useMemo(() => manifests.find(m => m.id === manifestId), [manifests, manifestId]);
  const openPallets = useMemo(() => selectedManifest?.pallets.filter(p => p.status === "OPEN") ?? [], [selectedManifest]);

  // Bulk delete
  async function handleDelete() {
    if (!confirm(`Delete ${selected.size} shipment(s)? This cannot be undone.`)) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/shipments/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Failed"); return; }
      setSelected(new Set()); closeModal();
      router.refresh();
    } catch { setError("Network error"); }
    finally { setBusy(false); }
  }

  // Bulk assign sender
  async function handleAssign() {
    if (!selectedCustomer) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/shipments/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), senderId: selectedCustomer.id }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Failed"); return; }
      setSelected(new Set()); closeModal();
      router.refresh();
    } catch { setError("Network error"); }
    finally { setBusy(false); }
  }

  // Bulk add to manifest pallet
  async function handleAddToManifest() {
    if (!manifestId || !palletId) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/manifests/${manifestId}/pallets/${palletId}/packages/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Failed"); return; }
      setSelected(new Set()); closeModal();
      router.refresh();
    } catch { setError("Network error"); }
    finally { setBusy(false); }
  }

  // Print labels
  const handlePrintLabels = useCallback(() => {
    const ids = Array.from(selected).join(",");
    window.open(`/label/print?ids=${ids}`, "_blank");
  }, [selected]);

  return (
    <div>
      {/* Bulk action bar */}
      {someSelected && canManage && (
        <div className="flex items-center gap-2 px-4 py-3 mb-3 bg-green-50 border border-green-200 rounded-xl flex-wrap">
          <span className="text-sm font-semibold text-green-800 mr-1">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <button
              onClick={handlePrintLabels}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Print Labels
            </button>
            <button
              onClick={() => openModal("assign")}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium"
            >
              Assign Customer
            </button>
            <button
              onClick={() => openModal("manifest")}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium"
            >
              Add to Manifest
            </button>
            <button
              onClick={() => openModal("delete")}
              className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            >
              Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="text-sm text-gray-400 hover:text-gray-600 px-2">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {canManage && (
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300 accent-green-700" />
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tracking #</th>
                {!isClient && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Shipper</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Receiver</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mode</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Payment</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Weight</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? (isClient ? 10 : 11) : (isClient ? 9 : 10)} className="px-4 py-10 text-center text-gray-400">
                    No shipments found.
                  </td>
                </tr>
              ) : shipments.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${selected.has(s.id) ? "bg-green-50" : ""}`}>
                  {canManage && (
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="rounded border-gray-300 accent-green-700" />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link href={`/shipments/${s.id}`} className="font-mono text-green-700 hover:underline">
                      {s.trackingNumber}
                    </Link>
                  </td>
                  {!isClient && (
                    <td className="px-4 py-3 text-gray-600">
                      {s.sender ? (
                        <span>{s.sender.name}{s.sender.userCode && <span className="ml-1 font-mono text-xs text-gray-400">[{s.sender.userCode}]</span>}</span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{s.shipperName}</div>
                    <div className="text-xs text-gray-400">{[s.shipperCity, s.shipperCountry].filter(Boolean).join(", ")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{s.receiverName}</div>
                    <div className="text-xs text-gray-400">{[s.receiverCity, s.receiverCountry].filter(Boolean).join(", ")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SHIPMENT_STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {SHIPMENT_STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.transportMode ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${MODE_COLORS[s.transportMode] ?? "bg-gray-100 text-gray-700"}`}>
                        {MODE_LABELS[s.transportMode] ?? s.transportMode}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.paymentMethod ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PAY_COLORS[s.paymentMethod] ?? "bg-gray-100 text-gray-700"}`}>
                        {s.paymentMethod}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.totalWeight.toFixed(2)} kg</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(s.totalAmount, s.currency)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Delete modal ─── */}
      {modal === "delete" && (
        <Modal title={`Delete ${selected.size} Shipment${selected.size !== 1 ? "s" : ""}?`} onClose={closeModal}>
          <p className="text-sm text-gray-600 mb-5">
            This will permanently delete <strong>{selected.size}</strong> shipment(s) and all associated data. This cannot be undone.
          </p>
          {error && <div className="text-sm text-red-500 mb-3">{error}</div>}
          <div className="flex gap-3 justify-end">
            <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleDelete} disabled={busy} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium">
              {busy ? "Deleting..." : `Delete ${selected.size}`}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Assign customer modal ─── */}
      {modal === "assign" && (
        <Modal title="Assign Customer" onClose={closeModal}>
          <p className="text-sm text-gray-500 mb-4">Assign <strong>{selected.size}</strong> shipment(s) to a customer account.</p>
          <div className="relative mb-3">
            <input
              autoFocus
              value={customerQuery}
              onChange={e => { setCustomerQuery(e.target.value); setSelectedCustomer(null); }}
              placeholder="Search name, email, code..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {customerResults.length > 0 && !selectedCustomer && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                {customerResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedCustomer(u); setCustomerQuery(u.name); setCustomerResults([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm"
                  >
                    <span className="font-medium">{u.name}</span>
                    {u.userCode && <span className="ml-1 text-xs text-gray-400 font-mono">#{u.userCode}</span>}
                    <span className="ml-1 text-xs text-gray-400">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedCustomer && (
            <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              Selected: <strong>{selectedCustomer.name}</strong>
              {selectedCustomer.userCode && <span className="ml-1 font-mono text-xs">#{selectedCustomer.userCode}</span>}
            </div>
          )}
          {error && <div className="text-sm text-red-500 mb-3">{error}</div>}
          <div className="flex gap-3 justify-end">
            <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleAssign} disabled={!selectedCustomer || busy} className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-lg font-medium">
              {busy ? "Assigning..." : "Assign"}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Add to manifest modal ─── */}
      {modal === "manifest" && (
        <Modal title="Add to Manifest" onClose={closeModal}>
          <p className="text-sm text-gray-500 mb-4">Add packages from <strong>{selected.size}</strong> shipment(s) to a manifest pallet.</p>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Manifest</label>
              {loadingManifests ? (
                <div className="text-sm text-gray-400 py-2">Loading...</div>
              ) : (
                <select
                  value={manifestId}
                  onChange={e => { setManifestId(e.target.value); setPalletId(""); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="">— select manifest —</option>
                  {manifests.map(m => (
                    <option key={m.id} value={m.id}>{m.manifestNumber} ({m.status})</option>
                  ))}
                </select>
              )}
            </div>
            {manifestId && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pallet (open only)</label>
                <select
                  value={palletId}
                  onChange={e => setPalletId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="">— select pallet —</option>
                  {openPallets.map(p => (
                    <option key={p.id} value={p.id}>{p.palletNumber}</option>
                  ))}
                </select>
                {openPallets.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">No open pallets — all pallets are sealed. Create a new pallet in the manifest first.</p>
                )}
              </div>
            )}
          </div>
          {error && <div className="text-sm text-red-500 mb-3">{error}</div>}
          <div className="flex gap-3 justify-end">
            <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleAddToManifest} disabled={!manifestId || !palletId || busy} className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-lg font-medium">
              {busy ? "Adding..." : "Add to Manifest"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
