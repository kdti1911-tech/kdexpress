import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function BranchesPage() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    redirect("/dashboard");
  }

  const branches = await db.branch.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { users: true, shipmentsOrigin: true },
      },
    },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
        <span className="text-sm text-gray-500">{branches.length} total</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Branch</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Staff</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Shipments</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {branches.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                <td className="px-4 py-3 font-mono text-gray-700">{b.code}</td>
                <td className="px-4 py-3 text-gray-600">
                  {[b.city, b.province, b.country].filter(Boolean).join(", ")}
                </td>
                <td className="px-4 py-3 text-gray-500">{b.phone ?? "—"}</td>
                <td className="px-4 py-3 text-right text-gray-900">{b._count.users}</td>
                <td className="px-4 py-3 text-right text-gray-900">{b._count.shipmentsOrigin}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {b.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
