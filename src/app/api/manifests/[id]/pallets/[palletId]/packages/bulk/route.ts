import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

type Params = { params: Promise<{ id: string; palletId: string }> };

// POST: bulk-add all packages of given shipments into a pallet
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "UPDATE_STATUS")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { palletId } = await params;
  const { shipmentIds } = await req.json();

  if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
    return NextResponse.json({ success: false, error: "shipmentIds required" }, { status: 400 });
  }

  const pallet = await db.pallet.findUnique({
    where: { id: palletId },
    select: { status: true },
  });
  if (!pallet) return NextResponse.json({ success: false, error: "Pallet not found" }, { status: 404 });
  if (pallet.status === "SEALED") {
    return NextResponse.json({ success: false, error: "Pallet is sealed" }, { status: 400 });
  }

  // Get all packages for the given shipments that are not yet in any pallet
  const packages = await db.shipmentPackage.findMany({
    where: {
      shipmentId: { in: shipmentIds },
      palletItem: null,
    },
    select: { id: true, trackingNumber: true },
  });

  if (packages.length === 0) {
    return NextResponse.json({ success: false, error: "No available packages (all may already be in a pallet)" }, { status: 400 });
  }

  await db.palletPackage.createMany({
    data: packages.map(pkg => ({
      palletId,
      packageId: pkg.id,
      scannedById: user.id,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    success: true,
    count: packages.length,
    skipped: (shipmentIds.length - packages.length),
  });
}
