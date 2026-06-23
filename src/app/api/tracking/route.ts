import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tracking = searchParams.get("tracking")?.trim().toUpperCase();

  if (!tracking) {
    return NextResponse.json(
      { success: false, error: "Tracking number required" },
      { status: 400 }
    );
  }

  const shipment = await db.shipment.findUnique({
    where: { trackingNumber: tracking },
    select: {
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
        orderBy: { createdAt: "asc" },
        select: {
          status: true,
          note: true,
          location: true,
          createdAt: true,
        },
      },
    },
  });

  if (!shipment) {
    return NextResponse.json(
      { success: false, error: "Tracking number not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: shipment });
}
