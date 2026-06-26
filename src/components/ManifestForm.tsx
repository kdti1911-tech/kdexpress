"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Branch = { id: string; name: string; code: string };

const TRANSPORT_OPTIONS = [
  { value: "AIR", label: "✈ AIR — Hàng không" },
  { value: "SEA", label: "🚢 SEA — Đường biển" },
  { value: "TRUCK", label: "🚛 TRUCK — Xe tải" },
  { value: "AIR_CANADA", label: "✈ AIR CANADA" },
  { value: "FAST_TRACK", label: "⚡ FAST TRACK" },
];

export default function ManifestForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    transportMode: "SEA",
    originBranchId: "",
    destBranchId: "",
    departureDate: "",
    arrivalDate: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/manifests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        originBranchId: form.originBranchId || undefined,
        destBranchId: form.destBranchId || undefined,
        departureDate: form.departureDate || undefined,
        arrivalDate: form.arrivalDate || undefined,
        notes: form.notes || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setError(data.error ?? "Lỗi"); return; }
    router.push(`/manifests/${data.data.id}`);
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Thông Tin Lô Hàng</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phương Thức Vận Chuyển <span className="text-red-500">*</span></label>
          <select name="transportMode" value={form.transportMode} onChange={handleChange} className={inputCls} required>
            {TRANSPORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chi Nhánh Gửi</label>
            <select name="originBranchId" value={form.originBranchId} onChange={handleChange} className={inputCls}>
              <option value="">— Chọn chi nhánh —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chi Nhánh Nhận</label>
            <select name="destBranchId" value={form.destBranchId} onChange={handleChange} className={inputCls}>
              <option value="">— Chọn chi nhánh —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày Xuất Phát</label>
            <input type="date" name="departureDate" value={form.departureDate} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày Dự Kiến Đến</label>
            <input type="date" name="arrivalDate" value={form.arrivalDate} onChange={handleChange} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ghi Chú</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className={inputCls} placeholder="Ghi chú nội bộ..." />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
          {saving ? "Đang tạo..." : "Tạo Lô Hàng"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
          Huỷ
        </button>
      </div>
    </form>
  );
}
