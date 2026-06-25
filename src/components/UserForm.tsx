"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, ALL_ROLES } from "@/lib/permissions";

type Branch = { id: string; name: string; code: string };

type UserData = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  userCode: string | null;
  markup: number;
  isActive: boolean;
  branchId: string | null;
};

interface Props {
  user?: UserData;
  branches: Branch[];
  canDelete?: boolean;
  canEditRole?: boolean;
}

export default function UserForm({ user, branches, canDelete = false, canEditRole = true }: Props) {
  const router = useRouter();
  const isEdit = !!user;

  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
    role: user?.role ?? "CLIENT",
    userCode: user?.userCode ?? "",
    branchId: user?.branchId ?? "",
    markup: String(user?.markup ?? 0),
    isActive: user?.isActive ?? true,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setForm((prev) => ({ ...prev, [name]: val }));
  }

  function regenerateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm((prev) => ({ ...prev, userCode: code }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      role: form.role,
      userCode: form.userCode || undefined,
      branchId: form.branchId || undefined,
      markup: parseFloat(form.markup) || 0,
      isActive: form.isActive,
    };
    if (form.password) body.password = form.password;
    if (!isEdit) body.password = form.password;

    const url = isEdit ? `/api/users/${user.id}` : "/api/users";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!data.success) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    router.push("/customers");
    router.refresh();
  }

  async function handleDelete() {
    if (!user || !confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.success) { setError(data.error ?? "Delete failed"); return; }
    router.push("/customers");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Basic Information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              name="name" value={form.name} onChange={handleChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nguyen Van A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input
              name="email" type="email" value={form.email} onChange={handleChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              name="phone" value={form.phone} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+1 416 555 0000"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEdit ? "New Password (leave blank to keep current)" : "Password"} {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <input
              name="password" type="password" value={form.password} onChange={handleChange}
              required={!isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isEdit ? "Leave blank to keep current password" : "Min 6 characters"}
            />
          </div>
        </div>
      </div>

      {/* Role & Code */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Role & Access</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
            <select
              name="role" value={form.role} onChange={handleChange} disabled={!canEditRole}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Code (4 chars)</label>
            <div className="flex gap-2">
              <input
                name="userCode"
                value={form.userCode}
                onChange={(e) => setForm((prev) => ({ ...prev, userCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) }))}
                maxLength={4}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Auto"
              />
              <button
                type="button" onClick={regenerateCode}
                className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 whitespace-nowrap"
                title="Generate random code"
              >
                ↺ Generate
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Leave blank to auto-generate. Used in tracking numbers.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              name="branchId" value={form.branchId} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— No branch —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Markup %</label>
            <input
              name="markup" type="number" value={form.markup} onChange={handleChange}
              min={0} max={100} step={0.1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Applied to shipping rates for this user.</p>
          </div>

          <div className="col-span-2 flex items-center gap-3 pt-1">
            <input
              type="checkbox" id="isActive" name="isActive"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active — user can log in and use the system
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            type="submit" disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
          </button>
          <button
            type="button" onClick={() => router.back()}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        {canDelete && isEdit && (
          <button
            type="button" onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete User"}
          </button>
        )}
      </div>
    </form>
  );
}
