import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ search?: string; role?: string; page?: string }>;
}

export default async function CustomersPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER", "EMPLOYEE"].includes(user.role)) {
    redirect("/dashboard");
  }

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

  const roleColors: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-700",
    MANAGER: "bg-purple-100 text-purple-700",
    EMPLOYEE: "bg-blue-100 text-blue-700",
    DRIVER: "bg-indigo-100 text-indigo-700",
    AGENT: "bg-orange-100 text-orange-700",
    AGENT_VN: "bg-yellow-100 text-yellow-700",
    CLIENT: "bg-gray-100 text-gray-700",
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>
          <div className="flex gap-2 flex-wrap">
            <a href={buildUrl({ role: undefined, page: "1" })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${!role ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All
            </a>
            {roles.map((r) => (
              <a key={r} href={buildUrl({ role: r, page: "1" })}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${role === r ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {r}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
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
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.name}</div>
                    <div className={`inline-block text-xs mt-0.5 ${!u.isActive ? "text-red-500" : "text-gray-400"}`}>
                      {!u.isActive && "Inactive"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{u.email}</div>
                    {u.phone && <div className="text-gray-400 text-xs">{u.phone}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">
                    {u.userCode ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.branch?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{u._count.shipmentsSender}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {u.markup > 0 ? `${u.markup}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">Page {page} of {totalPages}</div>
            <div className="flex gap-2">
              {page > 1 && <a href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Previous</a>}
              {page < totalPages && <a href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Next</a>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
