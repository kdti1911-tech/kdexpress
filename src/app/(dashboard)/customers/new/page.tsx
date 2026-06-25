import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import UserForm from "@/components/UserForm";
import Link from "next/link";

export default async function NewUserPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "CREATE_USER")) redirect("/customers");

  const branches = await db.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/customers" className="text-gray-400 hover:text-gray-600 text-sm">← Users</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">New User</h1>
      </div>

      <UserForm branches={branches} canDelete={false} canEditRole={can(user.role, "EDIT_USER")} />
    </div>
  );
}
