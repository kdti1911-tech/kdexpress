"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";

type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  userCode: string | null;
  markup: number;
  isActive: boolean;
  createdAt: Date;
  branch: { name: string } | null;
  _count: { shipmentsSender: number };
};

const ROLES = ["ADMIN", "MANAGER", "EMPLOYEE", "DRIVER", "AGENT", "AGENT_VN", "CLIENT"] as const;

export default function CustomersClient({
  users,
  canManage,
}: {
  users: User[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<string>("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const allIds = useMemo(() => users.map(u => u.id), [users]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function applyBulkRole() {
    if (!bulkRole || selected.size === 0) return;
    if (!confirm(`Change role to "${ROLE_LABELS[bulkRole as keyof typeof ROLE_LABELS] ?? bulkRole}" for ${selected.size} user(s)?`)) return;
    setApplying(true); setError("");
    try {
      const res = await fetch("/api/users/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selected), role: bulkRole }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Failed"); return; }
      setSelected(new Set());
      setBulkRole("");
      router.refresh();
    } catch { setError("Network error"); }
    finally { setApplying(false); }
  }

  return (
    <div>
      {/* Bulk action bar */}
      {someSelected && canManage && (
        <div className="flex items-center gap-3 px-4 py-3 mb-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-sm font-medium text-green-800">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">Change role to:</span>
            <select
              value={bulkRole}
              onChange={e => setBulkRole(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
            >
              <option value="">— select —</option>
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              onClick={applyBulkRole}
              disabled={!bulkRole || applying}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {applying ? "Applying..." : "Apply"}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-sm text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {canManage && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-300 accent-green-700"
                  />
                </th>
              )}
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contact</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Branch</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Shipments</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Markup</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-4 py-10 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            ) : users.map(u => (
              <tr
                key={u.id}
                className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected.has(u.id) ? "bg-green-50" : ""}`}
              >
                {canManage && (
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggle(u.id)}
                      className="rounded border-gray-300 accent-green-700"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/customers/${u.id}`} className="block">
                    <div className="font-medium text-gray-900">{u.name}</div>
                    {!u.isActive && <div className="text-xs text-red-500 mt-0.5">Inactive</div>}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <Link href={`/customers/${u.id}`} className="block">
                    <div>{u.email}</div>
                    {u.phone && <div className="text-gray-400 text-xs">{u.phone}</div>}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-gray-700">
                  <Link href={`/customers/${u.id}`} className="block">{u.userCode ?? "—"}</Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/customers/${u.id}`} className="block">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role as keyof typeof ROLE_COLORS] ?? "bg-gray-100 text-gray-700"}`}>
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  <Link href={`/customers/${u.id}`} className="block">{u.branch?.name ?? "—"}</Link>
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  <Link href={`/customers/${u.id}`} className="block">{u._count.shipmentsSender}</Link>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  <Link href={`/customers/${u.id}`} className="block">{u.markup > 0 ? `${u.markup}%` : "—"}</Link>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  <Link href={`/customers/${u.id}`} className="block">{formatDate(u.createdAt)}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
