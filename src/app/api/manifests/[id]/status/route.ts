import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// Status transition map
const TRANSITIONS: Record<string, string[]> = {
  PLANNING:   ["LOADING"],
  LOADING:    ["SEALED", "PLANNING"],
  SEALED:     ["DISPATCHED", "LOADING"],
  DISPATCHED: ["IN_TRANSIT"],
  IN_TRANSIT: ["ARRIVED"],
  ARRIVED:    ["CLOSED"],
  CLOSED:     [],
};

// Shipment statuses to bulk-set when manifest transitions
const MANIFEST_TO_SHIPMENT_STATUS: Record<string, string | null> = {
  DISPATCHED: "IN_TRANSIT",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED:    "ARRIVED_DESTINATION",
  CLOSED:     null,
};

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "UPDATE_STATUS")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { status, note } = await req.json();

  const manifest = await db.manifest.findUnique({
    where: { id },
    include: {
      pallets: {
        include: {
          packages: {
            include: { package: { select: { shipmentId: true } } },
          },
        },
      },
    },
  });

  if (!manifest) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const allowed = TRANSITIONS[manifest.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { success: false, error: `Cannot transition from ${manifest.status} to ${status}` },
      { status: 400 }
    );
  }

  const now = new Date();
  const dateFields: Record<string, Date> = {};
  if (status === "SEALED")     dateFields.sealedAt = now;
  if (status === "DISPATCHED") dateFields.dispatchedAt = now;
  if (status === "ARRIVED")    dateFields.arrivedAt = now;

  // Update manifest status
  const updated = await db.manifest.update({
    where: { id },
    data: { status: status as never, ...dateFields },
  });

  // Bulk update shipment packages & add status history
  const shipmentStatus = MANIFEST_TO_SHIPMENT_STATUS[status];
  if (shipmentStatus) {
    const packageIds = manifest.pallets.flatMap((p) => p.packages.map((pp) => pp.package.shipmentId));
    const uniqueShipmentIds = [...new Set(packageIds)];

    await db.shipment.updateMany({
      where: { id: { in: uniqueShipmentIds } },
      data: { status: shipmentStatus as never },
    });

    await db.shipmentStatusHistory.createMany({
      data: uniqueShipmentIds.map((shipmentId) => ({
        shipmentId,
        status: shipmentStatus as never,
        note: note || `Manifest ${manifest.code} → ${status}`,
        updatedById: user.id,
      })),
    });
  }

  return NextResponse.json({ success: true, data: updated });
}
