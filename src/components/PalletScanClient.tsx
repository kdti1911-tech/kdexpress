"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type PackageItem = {
  palletId: string; packageId: string; addedAt: string;
  addedBy: { name: string } | null;
  package: {
    id: string; trackingNumber: string | null; sequence: number; weight: number; description: string | null;
    shipment: { id: string; trackingNumber: string; shipperName: string; receiverName: string; receiverCountry: string };
  };
};

type Pallet = {
  id: string; code: string; status: "OPEN" | "SEALED"; destination: string | null; notes: string | null;
  manifest: { id: string; code: string; status: string };
  packages: PackageItem[];
};

export default function PalletScanClient({ pallet, manifestId }: { pallet: Pallet; manifestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scan, setScan] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const value = scan.trim();
    if (!value) return;
    setScanning(true);
    setLastResult(null);

    const res = await fetch(`/api/manifests/${manifestId}/pallets/${pallet.id}/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingNumber: value }),
    });
    const data = await res.json();
    setScanning(false);
    setScan("");
    inputRef.current?.focus();

    if (data.success) {
      setLastResult({ ok: true, message: `✓ ${(data.data.package.trackingNumber ?? value).replace(/-/g, "")} — ${data.data.package.shipment.receiverName}` });
      refresh();
    } else {
      setLastResult({ ok: false, message: `✗ ${data.error}` });
    }
  }

  async function removePackage(packageId: string) {
    setRemoving(packageId);
    const res = await fetch(`/api/manifests/${manifestId}/pallets/${pallet.id}/packages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
    const data = await res.json();
    setRemoving(null);
    if (data.success) refresh();
  }

  async function toggleSeal() {
    setSealing(true);
    const newStatus = pallet.status === "OPEN" ? "SEALED" : "OPEN";
    const res = await fetch(`/api/manifests/${manifestId}/pallets/${pallet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    setSealing(false);
    if (data.success) refresh();
  }

  const totalWeight = pallet.packages.reduce((s, pp) => s + (pp.package.weight ?? 0), 0);
  const isSealed = pallet.status === "SEALED";

  return (
    <div className="space-y-5 relative">
      {/* Refresh overlay */}
      {isPending && (
        <div className="fixed inset-0 bg-white/40 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-5 py-3 flex items-center gap-3 text-sm text-gray-600">
            <svg className="animate-spin w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Updating...
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{pallet.packages.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Packages</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalWeight.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total kg</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${isSealed ? "bg-blue-100 text-blue-700" : "bg-green-50 text-green-700"}`}>
            {pallet.status}
          </span>
          <div className="text-xs text-gray-500 mt-1">{pallet.destination ?? "No destination"}</div>
        </div>
      </div>

      {/* Scan input */}
      {!isSealed && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Scan Package</h2>
          <form onSubmit={handleScan} className="flex gap-3">
            <input
              ref={inputRef}
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="Scan or enter tracking code..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-600"
              disabled={scanning}
              autoComplete="off"
            />
            <button type="submit" disabled={scanning || !scan.trim()}
              className="px-5 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
              {scanning ? "..." : "Confirm"}
            </button>
          </form>
          {lastResult && (
            <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm font-medium ${lastResult.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {lastResult.message}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-400">Codes with or without dashes are accepted. E.g. KDCA001 or KD-CA-001</p>
        </div>
      )}

      {/* Seal / Unseal */}
      <div className="flex gap-3">
        <button onClick={toggleSeal} disabled={sealing || isPending}
          className={`px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${isSealed ? "border border-gray-300 text-gray-700 hover:bg-gray-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
          {sealing ? "..." : isSealed ? "🔓 Unseal" : "🔒 Seal Pallet"}
        </button>
        <Link href={`/manifests/${manifestId}`}
          className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
          ← Back to Manifest
        </Link>
      </div>

      {/* Package list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Package List ({pallet.packages.length})</h2>
        </div>
        {pallet.packages.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No packages yet. Scan a tracking code to add.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="text-left px-4 py-2">Package #</th>
                <th className="text-left px-4 py-2">Shipment</th>
                <th className="text-left px-4 py-2">Shipper → Receiver</th>
                <th className="text-right px-4 py-2">KG</th>
                <th className="text-left px-4 py-2">Description</th>
                {!isSealed && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pallet.packages.map((pp) => (
                <tr key={pp.packageId} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-green-700">
                    {(pp.package.trackingNumber ?? "").replace(/-/g, "")}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/shipments/${pp.package.shipment.id}`} className="font-mono text-xs text-gray-600 hover:text-green-700">
                      {pp.package.shipment.trackingNumber.replace(/-/g, "")}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-700">
                    <span>{pp.package.shipment.shipperName}</span>
                    <span className="text-gray-400 mx-1">→</span>
                    <span>{pp.package.shipment.receiverName}</span>
                    <span className="text-gray-400 ml-1">({pp.package.shipment.receiverCountry})</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-900 text-xs">{pp.package.weight.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{pp.package.description ?? "—"}</td>
                  {!isSealed && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => removePackage(pp.packageId)}
                        disabled={removing === pp.packageId || isPending}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                      >
                        {removing === pp.packageId ? "..." : "Remove"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
