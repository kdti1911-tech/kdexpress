import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/permissions";
import CustomersClient from "./CustomersClient";

interface Props {
  searchParams: Promise<{ search?: string; role?: string; page?: string }>;
}

export default async function CustomersPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "VIEW_USERS")) {
    redirect("/dashboard");
  }
  const canCreate = can(user.role, "CREATE_USER");
  const canManage = can(user.role, "MANAGE_BRANCHES");

  const params = await searchParams;
  const search = params.search ?? "";
  const role = params.role ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const limit = 20;

  const where = {
    ...(role ? { role: role as never } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { userCode: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        userCode: true,
        markup: true,
        isActive: true,
        createdAt: true,
        branch: { select: { name: true } },
        _count: { select: { shipmentsSender: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const roles = ["CLIENT", "AGENT", "AGENT_VN", "EMPLOYEE", "DRIVER", "MANAGER", "ADMIN"];

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (search && !("search" in overrides)) p.set("search", search);
    if (role && !("role" in overrides)) p.set("role", role);
    if (page > 1 && !("page" in overrides)) p.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
    }
    const str = p.toString();
    return `/customers${str ? "?" + str : ""}`;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        {canCreate && (
          <Link href="/customers/new" className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800">
            + New User
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <form className="flex-1 min-w-[200px]">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search name, email, code, phone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </form>
          <div className="flex gap-2 flex-wrap">
            <a href={buildUrl({ role: undefined, page: "1" })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${!role ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All
            </a>
            {roles.map(r => (
              <a key={r} href={buildUrl({ role: r, page: "1" })}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${role === r ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
              </a>
            ))}
          </div>
        </div>
      </div>

      <CustomersClient users={users} canManage={canManage} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 mt-2">
          <div className="text-sm text-gray-500">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            {page > 1 && <a href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 bg-white">Previous</a>}
            {page < totalPages && <a href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 bg-white">Next</a>}
          </div>
        </div>
      )}
    </div>
  );
}
