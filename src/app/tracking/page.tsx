"use client";

import { useState } from "react";
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLORS, formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";

type StatusEvent = {
  status: string;
  note: string | null;
  location: string | null;
  createdAt: string;
};

type PackagePiece = {
  id: string;
  trackingNumber: string | null;
  sequence: number;
  description: string | null;
  weight: number;
  length: number | null;
  width: number | null;
  height: number | null;
  isFragile: boolean;
};

type TrackingResult = {
  trackingNumber: string;
  status: string;
  shipperName: string;
  shipperCity: string | null;
  shipperCountry: string;
  receiverName: string;
  receiverCity: string | null;
  receiverCountry: string;
  totalWeight: number;
  totalPieces: number;
  pickupDate: string | null;
  expectedDelivery: string | null;
  deliveredAt: string | null;
  createdAt: string;
  statusHistory: StatusEvent[];
  packages: PackagePiece[];
  searchedPieceTracking: string | null;
};

export default function TrackingPage() {
  const [trackingNum, setTrackingNum] = useState("");
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = trackingNum.trim().toUpperCase();
    if (!q) return;

    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/tracking?tracking=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Tracking number not found");
        return;
      }
      setResult(data.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">KDExpress</span>
          </div>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            Staff Login →
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Search */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Track Your Shipment</h1>
          <p className="text-gray-500">Enter your tracking number to see the latest status</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 mb-10">
          <input
            type="text"
            value={trackingNum}
            onChange={(e) => setTrackingNum(e.target.value)}
            placeholder="Enter tracking number (e.g. KDX...)"
            className="flex-1 px-5 py-3.5 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm font-mono"
          />
          <button
            type="submit"
            disabled={loading || !trackingNum.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-8 py-3.5 rounded-xl shadow-sm transition-colors"
          >
            {loading ? "Searching..." : "Track"}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-center mb-6">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Status Banner */}
            <div
              className={`px-6 py-5 ${
                result.status === "DELIVERED"
                  ? "bg-green-50 border-b border-green-100"
                  : "bg-blue-50 border-b border-blue-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Tracking Number</div>
                  <div className="font-mono font-bold text-xl text-gray-900">{result.trackingNumber}</div>
                </div>
                <span
                  className={`text-sm font-semibold px-4 py-2 rounded-full ${
                    SHIPMENT_STATUS_COLORS[result.status] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {SHIPMENT_STATUS_LABELS[result.status] ?? result.status}
                </span>
              </div>
            </div>

            {/* Shipment Info */}
            <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100 border-b border-gray-100">
              <InfoBlock label="From" value={[result.shipperCity, result.shipperCountry].filter(Boolean).join(", ")} />
              <InfoBlock label="To" value={[result.receiverCity, result.receiverCountry].filter(Boolean).join(", ")} />
              <InfoBlock
                label="Weight / Pieces"
                value={`${result.totalWeight.toFixed(2)} kg · ${result.totalPieces} pc`}
              />
            </div>

            {(result.pickupDate || result.expectedDelivery || result.deliveredAt) && (
              <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100 border-b border-gray-100">
                {result.pickupDate && <InfoBlock label="Picked Up" value={formatDate(result.pickupDate)} />}
                {result.expectedDelivery && (
                  <InfoBlock label="Expected Delivery" value={formatDate(result.expectedDelivery)} />
                )}
                {result.deliveredAt && (
                  <InfoBlock label="Delivered" value={formatDateTime(result.deliveredAt)} />
                )}
              </div>
            )}

            {/* Packages */}
            {result.packages.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Pieces ({result.totalPieces})
                </h3>
                <div className="space-y-2">
                  {result.packages.map((pkg) => {
                    const isSearched = pkg.trackingNumber === result.searchedPieceTracking;
                    return (
                      <div
                        key={pkg.id}
                        className={`flex items-center gap-4 p-3 rounded-lg text-sm ${
                          isSearched
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-gray-50 border border-gray-100"
                        }`}
                      >
                        <span className="text-gray-400 font-medium w-6 text-center">
                          {pkg.sequence}
                        </span>
                        <div className="flex-1">
                          {pkg.trackingNumber && (
                            <div className="font-mono font-semibold text-gray-900">
                              {pkg.trackingNumber}
                              {isSearched && (
                                <span className="ml-2 text-xs text-blue-600 font-sans">(this piece)</span>
                              )}
                            </div>
                          )}
                          {pkg.description && (
                            <div className="text-gray-500 text-xs">{pkg.description}</div>
                          )}
                        </div>
                        <div className="text-right text-gray-600">
                          <div>{pkg.weight.toFixed(2)} kg</div>
                          {pkg.length && pkg.width && pkg.height && (
                            <div className="text-xs text-gray-400">
                              {pkg.length}×{pkg.width}×{pkg.height} cm
                            </div>
                          )}
                          {pkg.isFragile && (
                            <div className="text-xs text-red-500 font-medium">Fragile</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-5">Tracking History</h3>
              <div className="space-y-0">
                {[...result.statusHistory].reverse().map((event, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                          i === 0 ? "bg-blue-500" : "bg-gray-300"
                        }`}
                      />
                      {i < result.statusHistory.length - 1 && (
                        <div className="w-0.5 bg-gray-200 flex-1 mt-1" style={{ minHeight: "1.5rem" }} />
                      )}
                    </div>
                    <div className="pb-5">
                      <div className="font-medium text-gray-900 text-sm">
                        {SHIPMENT_STATUS_LABELS[event.status] ?? event.status}
                      </div>
                      {event.note && <div className="text-sm text-gray-600">{event.note}</div>}
                      {event.location && <div className="text-xs text-gray-400">{event.location}</div>}
                      <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(event.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-sm text-gray-400 mt-8">
          Questions? Contact us for support with your shipment.
        </p>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value || "—"}</div>
    </div>
  );
}
