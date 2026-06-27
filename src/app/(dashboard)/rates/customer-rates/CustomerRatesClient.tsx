"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  userCode: string | null;
  role: string;
  userRate: { ratePerKg: number; note: string | null; isActive: boolean } | null;
  _count: { shipmentsSender: number };
};

interface Props {
  customers: Customer[];
  roleLabels: Record<string, string>;
  roleColors: Record<string, string>;
}

export default function CustomerRatesClient({ customers: initial, roleLabels, roleColors }: Props) {
  const [customers, setCustomers] = useState(initial);
  const [editId, setEditId] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterHasRate, setFilterHasRate] = useState<"all" | "set" | "unset">("all");

  const filtered = useMemo(() => {
    let list = customers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.userCode ?? "").toLowerCase().includes(q)
      );
    }
    if (filterHasRate === "set") list = list.filter(c => c.userRate?.isActive);
    if (filterHasRate === "unset") list = list.filter(c => !c.userRate?.isActive);
    return list;
  }, [customers, search, filterHasRate]);

  function startEdit(c: Customer) {
    setEditId(c.id);
    setRateInput(c.userRate?.isActive ? String(c.userRate.ratePerKg) : "");
    setNoteInput(c.userRate?.note ?? "");
    setError("");
  }

  function cancelEdit() {
    setEditId(null);
    setError("");
  }

  async function saveRate(customerId: string) {
    const val = parseFloat(rateInput);
    if (!val || val <= 0) { setError("Rate must be a positive number"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/users/${customerId}/rate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratePerKg: val, note: noteInput || undefined, isActive: true }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Failed to save"); return; }
      setCustomers(prev => prev.map(c =>
        c.id === customerId
          ? { ...c, userRate: { ratePerKg: val, note: noteInput || null, isActive: true } }
          : c
      ));
      setEditId(null);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  async function removeRate(customerId: string) {
    if (!confirm("Remove custom rate for this customer?")) return;
    setSaving(true);
    try {
      await fetch(`/api/users/${customerId}/rate`, { method: "DELETE" });
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, userRate: null } : c
      ));
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Filters */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, code..."
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <div className="flex gap-1">
          {(["all", "set", "unset"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterHasRate(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                filterHasRate === f ? "bg-green-700 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === "all" ? "All" : f === "set" ? "Has rate" : "No rate"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-5 py-2 bg-red-50 text-sm text-red-600 border-b border-red-100">{error}</div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">Customer / Agent</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">Role</th>
            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400">Shipments</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">Rate / kg</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">Note</th>
            <th className="px-5 py-3 w-40"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                No customers found.
              </td>
            </tr>
          )}
          {filtered.map(c => {
            const isEditing = editId === c.id;
            const hasRate = c.userRate?.isActive;

            return (
              <tr key={c.id} className={isEditing ? "bg-green-50" : "hover:bg-gray-50"}>
                {/* Name */}
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-400">
                    {c.userCode && <span className="mr-2 font-mono">#{c.userCode}</span>}
                    {c.email}
                  </div>
                </td>

                {/* Role */}
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[c.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {roleLabels[c.role] ?? c.role}
                  </span>
                </td>

                {/* Shipment count */}
                <td className="px-5 py-3 text-right text-gray-500">{c._count.shipmentsSender}</td>

                {/* Rate */}
                <td className="px-5 py-3">
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={rateInput}
                      onChange={e => setRateInput(e.target.value)}
                      autoFocus
                      className="w-28 px-2 py-1 border border-green-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      placeholder="e.g. 5.50"
                    />
                  ) : hasRate ? (
                    <span className="font-semibold text-green-800">
                      {formatCurrency(c.userRate!.ratePerKg)}/kg
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">— not set</span>
                  )}
                </td>

                {/* Note */}
                <td className="px-5 py-3">
                  {isEditing ? (
                    <input
                      value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      className="w-40 px-2 py-1 border border-green-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      placeholder="e.g. Agent 2025"
                    />
                  ) : (
                    <span className="text-gray-400 text-xs">{c.userRate?.note ?? ""}</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-5 py-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveRate(c.id)}
                        disabled={saving}
                        className="px-3 py-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-medium rounded"
                      >
                        {saving ? "..." : "Save"}
                      </button>
                      <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => startEdit(c)}
                        className="text-xs text-green-700 hover:underline"
                      >
                        {hasRate ? "Edit" : "Set rate"}
                      </button>
                      {hasRate && (
                        <button
                          onClick={() => removeRate(c.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
