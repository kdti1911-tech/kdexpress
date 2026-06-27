import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildDefaultPermissionsMap, setPermissionsCache } from "@/lib/permissions";
import PermissionsClient from "./PermissionsClient";

export default async function PermissionsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  let entries = await db.rolePermission.findMany();

  if (entries.length === 0) {
    const defaults = buildDefaultPermissionsMap();
    await db.rolePermission.createMany({ data: defaults });
    entries = await db.rolePermission.findMany();
  }

  // Keep module cache warm
  setPermissionsCache(entries);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Permission Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure what each role can do. Admin always retains all permissions.
        </p>
      </div>

      <PermissionsClient initialEntries={entries} />
    </div>
  );
}
