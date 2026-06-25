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

// Permission → allowed roles (mirrors WPCargo capability model)
const P = {
  // Shipments
  CREATE_SHIPMENT:    ["ADMIN","MANAGER","EMPLOYEE","AGENT","AGENT_VN","CLIENT"] as UserRole[],
  VIEW_ALL_SHIPMENTS: ["ADMIN","MANAGER","EMPLOYEE","AGENT","AGENT_VN","DRIVER"] as UserRole[],
  EDIT_SHIPMENT:      ["ADMIN","MANAGER","EMPLOYEE","AGENT","AGENT_VN"] as UserRole[],
  DELETE_SHIPMENT:    ["ADMIN","MANAGER"] as UserRole[],
  UPDATE_STATUS:      ["ADMIN","MANAGER","EMPLOYEE","DRIVER"] as UserRole[],
  // Users
  VIEW_USERS:         ["ADMIN","MANAGER","EMPLOYEE"] as UserRole[],
  CREATE_USER:        ["ADMIN","MANAGER"] as UserRole[],
  EDIT_USER:          ["ADMIN","MANAGER"] as UserRole[],
  DELETE_USER:        ["ADMIN"] as UserRole[],
  // System
  MANAGE_RATES:       ["ADMIN","MANAGER"] as UserRole[],
  MANAGE_BRANCHES:    ["ADMIN","MANAGER"] as UserRole[],
  VIEW_REPORTS:       ["ADMIN","MANAGER","EMPLOYEE"] as UserRole[],
} as const;

export type Permission = keyof typeof P;

export function can(role: string, permission: Permission): boolean {
  return (P[permission] as string[]).includes(role);
}

export const PERMISSIONS = P;
