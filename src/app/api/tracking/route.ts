import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SHIPMENT_SELECT = {
  trackingNumber: true,
  status: true,
  shipperName: true,
  shipperCity: true,
  shipperCountry: true,
  receiverName: true,
  receiverCity: true,
  receiverCountry: true,
  totalWeight: true,
  totalPieces: true,
  pickupDate: true,
  expectedDelivery: true,
  deliveredAt: true,
  createdAt: true,
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    select: {
      status: true,
      note: true,
      location: true,
      createdAt: true,
    },
  },
  packages: {
    orderBy: { sequence: "asc" as const },
    select: {
      id: true,
      trackingNumber: true,
      sequence: true,
      description: true,
      weight: true,
      length: true,
      width: true,
      height: true,
      isFragile: true,
    },
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tracking = searchParams.get("tracking")?.trim().toUpperCase();

  if (!tracking) {
    return NextResponse.json(
      { success: false, error: "Tracking number required" },
      { status: 400 }
    );
  }

  // Try master tracking first
  let shipment = await db.shipment.findUnique({
    where: { trackingNumber: tracking },
    select: SHIPMENT_SELECT,
  });

  let searchedPieceTracking: string | null = null;

  if (!shipment) {
    // Try child (package) tracking
    const pkg = await db.shipmentPackage.findUnique({
      where: { trackingNumber: tracking },
      select: { shipmentId: true },
    });
    if (pkg) {
      shipment = await db.shipment.findUnique({
        where: { id: pkg.shipmentId },
        select: SHIPMENT_SELECT,
      });
      searchedPieceTracking = tracking;
    }
  }

  if (!shipment) {
    return NextResponse.json(
      { success: false, error: "Tracking number not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { ...shipment, searchedPieceTracking },
  });
}
