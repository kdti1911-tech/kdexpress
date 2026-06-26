import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import Link from "next/link";
import ManifestDetailClient from "@/components/ManifestDetailClient";

type Params = { params: Promise<{ id: string }> };

export default async function ManifestDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "VIEW_ALL_SHIPMENTS")) redirect("/dashboard");

  const { id } = await params;

  const [manifest, branches] = await Promise.all([
    db.manifest.findUnique({
      where: { id },
      include: {
        originBranch: { select: { id: true, name: true, code: true } },
        destBranch:   { select: { id: true, name: true, code: true } },
        createdBy:    { select: { name: true } },
        pallets: {
          orderBy: { createdAt: "asc" },
          include: {
            packages: {
              orderBy: { addedAt: "asc" },
              include: {
                package: {
                  select: {
                    id: true,
                    trackingNumber: true,
                    sequence: true,
                    weight: true,
                    description: true,
                    shipment: {
                      select: {
                        id: true,
                        trackingNumber: true,
                        shipperName: true,
                        receiverName: true,
                        receiverCountry: true,
                      },
                    },
                  },
                },
                addedBy: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    db.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);

  if (!manifest) notFound();

  const canManage = can(user.role, "MANAGE_BRANCHES");
  const canUpdateStatus = can(user.role, "UPDATE_STATUS");

  const totalPieces = manifest.pallets.reduce((s, p) => s + p.packages.length, 0);
  const totalWeight = manifest.pallets.reduce(
    (s, p) => s + p.packages.reduce((ws, pp) => ws + (pp.package.weight ?? 0), 0), 0
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/manifests" className="text-gray-400 hover:text-gray-600 text-sm">← Manifests</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 font-mono">{manifest.code}</h1>
      </div>

      <ManifestDetailClient
        manifest={manifest as never}
        branches={branches}
        canManage={canManage}
        canUpdateStatus={canUpdateStatus}
        totalPieces={totalPieces}
        totalWeight={totalWeight}
      />
    </div>
  );
}
