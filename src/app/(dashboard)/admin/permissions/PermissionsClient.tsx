"use client";

import { Fragment, useState, useMemo } from "react";
import { ROLE_LABELS } from "@/lib/permissions";

type Entry = { role: string; permission: string; granted: boolean };

const GROUPS = [
  {
    label: "Shipments",
    items: [
      { key: "CREATE_SHIPMENT", label: "Create Shipment" },
      { key: "VIEW_ALL_SHIPMENTS", label: "View All Shipments" },
      { key: "EDIT_SHIPMENT", label: "Edit Shipment" },
      { key: "DELETE_SHIPMENT", label: "Delete Shipment" },
      { key: "UPDATE_STATUS", label: "Update Status" },
    ],
  },
  {
    label: "Users",
    items: [
      { key: "VIEW_USERS", label: "View Users" },
      { key: "CREATE_USER", label: "Create User" },
      { key: "EDIT_USER", label: "Edit User" },
      { key: "DELETE_USER", label: "Delete User" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "MANAGE_RATES", label: "Manage Rates & Pricing" },
      { key: "MANAGE_BRANCHES", label: "Manage Branches & Manifests" },
      { key: "VIEW_REPORTS", label: "View Reports" },
    ],
  },
];

const EDITABLE_ROLES = ["MANAGER", "EMPLOYEE", "DRIVER", "AGENT", "AGENT_VN", "CLIENT"] as const;

function toMap(entries: Entry[]): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const e of entries) m[`${e.permission}:${e.role}`] = e.granted;
  return m;
}

export default function PermissionsClient({ initialEntries }: { initialEntries: Entry[] }) {
  const [state, setState] = useState<Record<string, boolean>>(() => toMap(initialEntries));
  const [original, setOriginal] = useState<Record<string, boolean>>(() => toMap(initialEntries));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const changedCount = useMemo(
    () => Object.keys(state).filter((k) => state[k] !== original[k]).length,
    [state, original]
  );

  function toggle(perm: string, role: string) {
    const key = `${perm}:${role}`;
    setState((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const allPerms = GROUPS.flatMap((g) => g.items.map((i) => i.key));
      const allRoles = ["ADMIN", ...EDITABLE_ROLES];
      const entries: Entry[] = [];
      for (const perm of allPerms) {
        for (const role of allRoles) {
          entries.push({ role, permission: perm, granted: state[`${perm}:${role}`] ?? false });
        }
      }
      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Failed to save"); return; }
      setOriginal({ ...state });
      setSaved(true);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefaults() {
    if (!confirm("Reset all permissions to system defaults? This will overwrite any custom settings.")) return;
    setSaving(true);
    setError("");
    try {
      // Load defaults from API (which re-seeds DB)
      const res = await fetch("/api/admin/permissions/defaults", { method: "POST" });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Failed"); return; }
      const newState = toMap(data.entries);
      setState(newState);
      setOriginal(newState);
      setSaved(true);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {changedCount > 0 && (
            <span className="text-sm text-orange-600 font-medium bg-orange-50 border border-orange-200 px-3 py-1 rounded-lg">
              {changedCount} unsaved change{changedCount !== 1 ? "s" : ""}
            </span>
          )}
          {saved && changedCount === 0 && (
            <span className="text-sm text-green-700 font-medium bg-green-50 border border-green-200 px-3 py-1 rounded-lg">
              Saved successfully
            </span>
          )}
          {error && (
            <span className="text-sm text-red-600">{error}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetToDefaults}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            onClick={save}
            disabled={saving || changedCount === 0}
            className="px-4 py-2 text-sm font-medium bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Permissions table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[220px]">
                  Permission
                </th>
                {/* ADMIN — locked */}
                <th className="px-4 py-3 text-center min-w-[90px]">
                  <div className="text-xs font-semibold text-red-600 uppercase">Admin</div>
                  <div className="text-xs text-gray-400 font-normal">locked</div>
                </th>
                {EDITABLE_ROLES.map((role) => (
                  <th key={role} className="px-4 py-3 text-center min-w-[90px]">
                    <div className="text-xs font-semibold text-gray-500 uppercase leading-tight">
                      {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => (
                <Fragment key={group.label}>
                  {/* Group header */}
                  <tr className="bg-green-50 border-y border-green-100">
                    <td
                      colSpan={2 + EDITABLE_ROLES.length}
                      className="px-4 py-2 text-xs font-semibold text-green-800 uppercase tracking-wide"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.items.map((item, idx) => {
                    const isLast = idx === group.items.length - 1;
                    return (
                      <tr
                        key={item.key}
                        className={`hover:bg-gray-50 transition-colors ${!isLast ? "border-b border-gray-50" : ""}`}
                      >
                        <td className="px-4 py-3 text-gray-800 font-medium">{item.label}</td>
                        {/* ADMIN — always checked, disabled */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={true}
                            disabled
                            className="w-4 h-4 rounded border-gray-300 accent-red-600 opacity-60 cursor-not-allowed"
                          />
                        </td>
                        {EDITABLE_ROLES.map((role) => {
                          const key = `${item.key}:${role}`;
                          const checked = state[key] ?? false;
                          const changed = checked !== original[key];
                          return (
                            <td key={role} className="px-4 py-3 text-center">
                              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${changed ? "bg-orange-50 ring-1 ring-orange-300" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggle(item.key, role)}
                                  className="w-4 h-4 rounded border-gray-300 accent-green-700 cursor-pointer"
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Changes take effect immediately after saving. Admin always retains all permissions.
      </p>
    </div>
  );
}
