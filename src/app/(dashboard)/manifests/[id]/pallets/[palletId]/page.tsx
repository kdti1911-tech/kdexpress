import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import Link from "next/link";
import PalletScanClient from "@/components/PalletScanClient";

type Params = { params: Promise<{ id: string; palletId: string }> };

export default async function PalletScanPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "UPDATE_STATUS")) redirect("/dashboard");

  const { id: manifestId, palletId } = await params;

  const pallet = await db.pallet.findUnique({
    where: { id: palletId },
    include: {
      manifest: { select: { id: true, code: true, status: true } },
      packages: {
        orderBy: { addedAt: "desc" },
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
  });

  if (!pallet || pallet.manifestId !== manifestId) notFound();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/manifests" className="text-gray-400 hover:text-gray-600 text-sm">← Manifests</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/manifests/${manifestId}`} className="text-gray-400 hover:text-gray-600 text-sm font-mono">
          {pallet.manifest.code}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 font-mono">{pallet.code}</h1>
      </div>

      <PalletScanClient pallet={pallet as never} manifestId={manifestId} />
    </div>
  );
}
