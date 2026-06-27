import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import UserForm from "@/components/UserForm";
import UserRateForm from "./UserRateForm";
import Link from "next/link";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export default async function EditUserPage({ params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!can(currentUser.role, "VIEW_USERS")) redirect("/dashboard");

  const { id } = await params;

  const [target, branches] = await Promise.all([
    db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        userCode: true,
        markup: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        lastLoginAt: true,
        branch: { select: { id: true, name: true, code: true } },
        userRate: true,
        _count: { select: { shipmentsSender: true } },
      },
    }),
    db.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!target) notFound();

  const canEdit = can(currentUser.role, "EDIT_USER");
  const canDelete = can(currentUser.role, "DELETE_USER") && target.id !== currentUser.id;
  const canManageRates = can(currentUser.role, "MANAGE_BRANCHES");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/customers" className="text-gray-400 hover:text-gray-600 text-sm">← Users</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{target.name}</h1>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[target.role as keyof typeof ROLE_COLORS] ?? "bg-gray-100 text-gray-700"}`}>
          {ROLE_LABELS[target.role as keyof typeof ROLE_LABELS] ?? target.role}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{target._count.shipmentsSender}</div>
          <div className="text-xs text-gray-500 mt-0.5">Shipments</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-sm font-mono font-bold text-gray-900">{target.userCode ?? "—"}</div>
          <div className="text-xs text-gray-500 mt-0.5">User Code</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-xs font-medium text-gray-900">{target.lastLoginAt ? formatDateTime(target.lastLoginAt) : "Never"}</div>
          <div className="text-xs text-gray-500 mt-0.5">Last Login</div>
        </div>
      </div>

      <div className="text-xs text-gray-400">Member since {formatDate(target.createdAt)}</div>

      {/* Custom Freight Rate */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">Custom Freight Rate</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Auto-applied when creating shipments for this customer. If not set, staff enters rate manually.
            </p>
          </div>
          {target.userRate && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${target.userRate.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {target.userRate.isActive ? "Active" : "Inactive"}
            </span>
          )}
        </div>

        {canManageRates ? (
          <UserRateForm
            userId={target.id}
            current={target.userRate ? {
              ratePerKg: target.userRate.ratePerKg,
              note: target.userRate.note ?? "",
              isActive: target.userRate.isActive,
            } : null}
          />
        ) : (
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            {target.userRate?.isActive
              ? (
                <span>
                  <span className="font-semibold text-gray-900">{formatCurrency(target.userRate.ratePerKg)}/kg</span>
                  {target.userRate.note && <span className="text-gray-400 ml-2">— {target.userRate.note}</span>}
                </span>
              )
              : <span className="text-gray-400">No custom rate — public rate applies</span>
            }
          </div>
        )}
      </div>

      {/* Profile Edit */}
      {canEdit ? (
        <UserForm
          user={{ ...target, phone: target.phone ?? null, userCode: target.userCode ?? null }}
          branches={branches}
          canDelete={canDelete}
          canEditRole={currentUser.role === "ADMIN"}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">You have view-only access to user profiles.</p>
        </div>
      )}
    </div>
  );
}
