"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

type Surcharge = {
  id: string;
  item: string;
  cost: number;
  costType: string;
  percentVal: number;
  hazardType: string | null;
  isActive: boolean;
  sortOrder: number;
};

interface Props {
  surcharges: Surcharge[];
  hazardLabels: Record<string, string>;
}

const EMPTY: Omit<Surcharge, "id"> = {
  item: "",
  cost: 0,
  costType: "flat",
  percentVal: 0,
  hazardType: null,
  isActive: true,
  sortOrder: 0,
};

export default function SurchargesClient({ surcharges: initial, hazardLabels }: Props) {
  const router = useRouter();
  const [surcharges, setSurcharges] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Surcharge, "id">>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Stable derived data — hazardLabels prop never changes
  const hazardOptions = useMemo(
    () => Object.entries(hazardLabels).filter(([k]) => k !== "NONE"),
    [hazardLabels]
  );

  function startAdd() {
    setAdding(true);
    setEditId(null);
    setForm(EMPTY);
    setError("");
  }

  function startEdit(s: Surcharge) {
    setEditId(s.id);
    setAdding(false);
    setForm({
      item: s.item,
      cost: s.cost,
      costType: s.costType,
      percentVal: s.percentVal,
      hazardType: s.hazardType,
      isActive: s.isActive,
      sortOrder: s.sortOrder,
    });
    setError("");
  }

  async function handleSave() {
    if (!form.item.trim()) { setError("Item name is required"); return; }
    setLoading(true); setError("");
    try {
      if (adding) {
        const res = await fetch("/api/rates/surcharges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!data.success) { setError(data.error ?? "Failed"); return; }
        setSurcharges(prev => [...prev, data.data]);
        setAdding(false);
      } else if (editId) {
        const res = await fetch(`/api/rates/surcharges/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!data.success) { setError(data.error ?? "Failed"); return; }
        setSurcharges(prev => prev.map(s => s.id === editId ? data.data : s));
        setEditId(null);
      }
      router.refresh();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this surcharge?")) return;
    setLoading(true);
    try {
      await fetch(`/api/rates/surcharges/${id}`, { method: "DELETE" });
      setSurcharges(prev => prev.filter(s => s.id !== id));
      router.refresh();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  const FormRow = () => (
    <tr className="bg-green-50">
      <td className="px-4 py-3">
        <input value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} className={inputCls} placeholder="Surcharge name" autoFocus />
      </td>
      <td className="px-4 py-3">
        <select value={form.hazardType ?? ""} onChange={e => setForm(f => ({ ...f, hazardType: e.target.value || null }))} className={inputCls}>
          <option value="">— None —</option>
          {hazardOptions.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select value={form.costType} onChange={e => setForm(f => ({ ...f, costType: e.target.value }))} className={inputCls}>
          <option value="flat">Flat</option>
          <option value="percent">Percent</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <input type="number" step="0.01" min="0" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} className={inputCls} />
      </td>
      <td className="px-4 py-3">
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
          Active
        </label>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={loading} className="px-3 py-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-medium rounded">
            {loading ? "..." : "Save"}
          </button>
          <button onClick={() => { setAdding(false); setEditId(null); setError(""); }} className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs">
            Cancel
          </button>
        </div>
        {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
      </td>
    </tr>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <span className="text-sm text-gray-500">{surcharges.length} surcharge(s)</span>
        <button onClick={startAdd} className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg">
          + Add Surcharge
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Name</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Hazard Type</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Type</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400">Cost</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Status</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {adding && <FormRow />}
          {surcharges.length === 0 && !adding ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                No surcharges yet. Click &quot;+ Add Surcharge&quot; to create one.
              </td>
            </tr>
          ) : surcharges.map(s => (
            editId === s.id ? (
              <FormRow key={s.id} />
            ) : (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 font-medium">{s.item}</td>
                <td className="px-4 py-3">
                  {s.hazardType ? (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      {hazardLabels[s.hazardType] ?? s.hazardType}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize">{s.costType}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {s.costType === "percent" ? `${s.percentVal}%` : formatCurrency(s.cost)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(s)} className="text-xs text-green-700 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}
