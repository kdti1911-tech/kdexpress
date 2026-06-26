import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import ManifestForm from "@/components/ManifestForm";

export default async function NewManifestPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "MANAGE_BRANCHES")) redirect("/manifests");

  const branches = await db.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href="/manifests" className="text-gray-400 hover:text-gray-600 text-sm">← Manifests</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">New Manifest</h1>
      </div>
      <ManifestForm branches={branches} />
    </div>
  );
}
