import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

type Params = { params: Promise<{ id: string; palletId: string }> };

// POST: scan a package into a pallet
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "UPDATE_STATUS")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { palletId } = await params;
  const { trackingNumber } = await req.json();

  if (!trackingNumber) {
    return NextResponse.json({ success: false, error: "Tracking number required" }, { status: 400 });
  }

  const pallet = await db.pallet.findUnique({
    where: { id: palletId },
    select: { status: true, manifestId: true },
  });
  if (!pallet) return NextResponse.json({ success: false, error: "Pallet not found" }, { status: 404 });
  if (pallet.status === "SEALED") {
    return NextResponse.json({ success: false, error: "Pallet is sealed — unseal first to add packages" }, { status: 400 });
  }

  // Find package by tracking number (case-insensitive, with or without dashes)
  const normalized = trackingNumber.trim().toUpperCase();
  const pkg = await db.shipmentPackage.findFirst({
    where: {
      OR: [
        { trackingNumber: normalized },
        { trackingNumber: normalized.replace(/-/g, "") },
      ],
    },
    include: {
      shipment: { select: { id: true, trackingNumber: true, shipperName: true, receiverName: true, receiverCountry: true } },
      palletItem: { include: { pallet: { select: { code: true, manifest: { select: { code: true } } } } } },
    },
  });

  if (!pkg) {
    return NextResponse.json({ success: false, error: `Package "${normalized}" not found` }, { status: 404 });
  }

  // Already in this pallet?
  if (pkg.palletItem?.palletId === palletId) {
    return NextResponse.json({ success: false, error: "Package already in this pallet" }, { status: 400 });
  }

  // Already in another pallet?
  if (pkg.palletItem) {
    return NextResponse.json(
      {
        success: false,
        error: `Package already in pallet ${pkg.palletItem.pallet.code} (${pkg.palletItem.pallet.manifest.code})`,
      },
      { status: 400 }
    );
  }

  const item = await db.palletPackage.create({
    data: { palletId, packageId: pkg.id, addedById: user.id },
    include: {
      package: {
        select: {
          id: true, trackingNumber: true, sequence: true, weight: true, description: true,
          shipment: { select: { id: true, trackingNumber: true, shipperName: true, receiverName: true, receiverCountry: true } },
        },
      },
    },
  });

  return NextResponse.json({ success: true, data: item });
}

// DELETE: remove a package from a pallet (body: { packageId })
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "UPDATE_STATUS")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { palletId } = await params;
  const { packageId } = await req.json();

  const pallet = await db.pallet.findUnique({ where: { id: palletId }, select: { status: true } });
  if (!pallet) return NextResponse.json({ success: false, error: "Pallet not found" }, { status: 404 });
  if (pallet.status === "SEALED") {
    return NextResponse.json({ success: false, error: "Pallet is sealed — unseal first to remove packages" }, { status: 400 });
  }

  await db.palletPackage.delete({ where: { palletId_packageId: { palletId, packageId } } });
  return NextResponse.json({ success: true });
}
