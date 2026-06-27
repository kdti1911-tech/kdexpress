"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface Props {
  userId: string;
  current: { ratePerKg: number; note: string; isActive: boolean } | null;
}

export default function UserRateForm({ userId, current }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [ratePerKg, setRatePerKg] = useState(String(current?.ratePerKg ?? ""));
  const [note, setNote] = useState(current?.note ?? "");
  const [isActive, setIsActive] = useState(current?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const val = parseFloat(ratePerKg);
    if (!val || val <= 0) { setError("Rate must be a positive number"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/users/${userId}/rate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratePerKg: val, note: note || undefined, isActive }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Failed to save"); return; }
      setEditing(false);
      router.refresh();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!confirm("Remove custom rate for this customer?")) return;
    setLoading(true);
    try {
      await fetch(`/api/users/${userId}/rate`, { method: "DELETE" });
      router.refresh();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 p-3 bg-gray-50 rounded-lg text-sm">
          {current?.isActive ? (
            <span>
              <span className="font-semibold text-gray-900 text-base">{formatCurrency(current.ratePerKg)}/kg</span>
              {current.note && <span className="text-gray-400 ml-2 text-xs">— {current.note}</span>}
            </span>
          ) : current ? (
            <span className="text-gray-400">Rate set but inactive: {formatCurrency(current.ratePerKg)}/kg</span>
          ) : (
            <span className="text-gray-400">No custom rate — staff enters rate manually per shipment</span>
          )}
        </div>
        <button
          onClick={() => { setEditing(true); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {current ? "Edit" : "Set Rate"}
        </button>
        {current && (
          <button onClick={handleDelete} disabled={loading} className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
            Remove
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rate per kg (CAD) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={ratePerKg}
            onChange={e => setRatePerKg(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            placeholder="e.g. 5.50"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            placeholder="e.g. Agent contract 2025"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded"
            />
            Active
          </label>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {loading ? "Saving..." : "Save Rate"}
        </button>
        <button
          onClick={() => { setEditing(false); setError(""); }}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
