import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import UserForm from "@/components/UserForm";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/utils";
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/customers" className="text-gray-400 hover:text-gray-600 text-sm">← Users</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{target.name}</h1>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[target.role as keyof typeof ROLE_COLORS] ?? "bg-gray-100 text-gray-700"}`}>
          {ROLE_LABELS[target.role as keyof typeof ROLE_LABELS] ?? target.role}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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

      <div className="text-xs text-gray-400 mb-4">Member since {formatDate(target.createdAt)}</div>

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
