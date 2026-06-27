import type { UserRole } from "@prisma/client";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  MANAGER: "Branch Manager",
  EMPLOYEE: "Employee",
  DRIVER: "Driver",
  AGENT: "Agent (CA)",
  AGENT_VN: "Agent (VN)",
  CLIENT: "Client",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-red-100 text-red-700",
  MANAGER: "bg-purple-100 text-purple-700",
  EMPLOYEE: "bg-blue-100 text-blue-700",
  DRIVER: "bg-indigo-100 text-indigo-700",
  AGENT: "bg-orange-100 text-orange-700",
  AGENT_VN: "bg-yellow-100 text-yellow-700",
  CLIENT: "bg-gray-100 text-gray-700",
};

export const ALL_ROLES: UserRole[] = [
  "ADMIN", "MANAGER", "EMPLOYEE", "DRIVER", "AGENT", "AGENT_VN", "CLIENT",
];

// Hardcoded defaults — used as fallback when DB is unavailable
const DEFAULTS = {
  CREATE_SHIPMENT:    ["ADMIN","MANAGER","EMPLOYEE","AGENT","AGENT_VN","CLIENT"] as UserRole[],
  VIEW_ALL_SHIPMENTS: ["ADMIN","MANAGER","EMPLOYEE","AGENT","AGENT_VN","DRIVER"] as UserRole[],
  EDIT_SHIPMENT:      ["ADMIN","MANAGER","EMPLOYEE","AGENT","AGENT_VN"] as UserRole[],
  DELETE_SHIPMENT:    ["ADMIN","MANAGER"] as UserRole[],
  UPDATE_STATUS:      ["ADMIN","MANAGER","EMPLOYEE","DRIVER"] as UserRole[],
  VIEW_USERS:         ["ADMIN","MANAGER","EMPLOYEE"] as UserRole[],
  CREATE_USER:        ["ADMIN","MANAGER"] as UserRole[],
  EDIT_USER:          ["ADMIN","MANAGER"] as UserRole[],
  DELETE_USER:        ["ADMIN"] as UserRole[],
  MANAGE_RATES:       ["ADMIN","MANAGER"] as UserRole[],
  MANAGE_BRANCHES:    ["ADMIN","MANAGER"] as UserRole[],
  VIEW_REPORTS:       ["ADMIN","MANAGER","EMPLOYEE"] as UserRole[],
} as const;

export type Permission = keyof typeof DEFAULTS;

// Legacy alias used by some imports
export const PERMISSIONS = DEFAULTS;

// Build flat list of all role/permission combos from defaults (for seeding DB)
export function buildDefaultPermissionsMap(): { role: string; permission: string; granted: boolean }[] {
  const entries: { role: string; permission: string; granted: boolean }[] = [];
  for (const [perm, roles] of Object.entries(DEFAULTS)) {
    for (const role of ALL_ROLES) {
      entries.push({ role, permission: perm, granted: (roles as string[]).includes(role) });
    }
  }
  return entries;
}

// ─── Module-level cache (persists between requests in Railway's Node.js) ──────

let _permCache: Map<string, boolean> | null = null;

export function setPermissionsCache(entries: { role: string; permission: string; granted: boolean }[]) {
  const m = new Map<string, boolean>();
  for (const e of entries) {
    m.set(`${e.role}:${e.permission}`, e.granted);
  }
  _permCache = m;
}

export function invalidatePermissionsCache() {
  _permCache = null;
}

export function can(role: string, permission: Permission): boolean {
  if (_permCache !== null) {
    return _permCache.get(`${role}:${permission}`) ?? false;
  }
  // Fallback to hardcoded defaults (e.g. before DB is loaded)
  return (DEFAULTS[permission] as string[]).includes(role);
}
