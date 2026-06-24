import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const isClient = ["CLIENT", "AGENT", "AGENT_VN"].includes(user.role);

  const where = {
    ...(isClient ? { senderId: user.id } : {}),
    ...(status ? { status: status as never } : {}),
    ...(search ? {
      OR: [
        { trackingNumber: { contains: search, mode: "insensitive" as const } },
        { shipperName: { contains: search, mode: "insensitive" as const } },
        { receiverName: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(from || to ? {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59Z") } : {}),
      },
    } : {}),
  };

  const shipments = await db.shipment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      trackingNumber: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      transportMode: true,
      paymentMethod: true,
      hazardType: true,
      shipperName: true,
      shipperPhone: true,
      shipperCity: true,
      shipperCountry: true,
      receiverName: true,
      receiverPhone: true,
      receiverCity: true,
      receiverProvince: true,
      receiverCountry: true,
      totalWeight: true,
      totalPieces: true,
      chargeableWeight: true,
      dimensionalWeight: true,
      baseRate: true,
      fuelSurcharge: true,
      insuranceAmount: true,
      surchargesTotal: true,
      totalAmount: true,
      currency: true,
      truckVendor: true,
      truckCost: true,
      shipmentCategory: true,
      marketingTracker: true,
      notes: true,
      sender: { select: { name: true, userCode: true } },
    },
  });

  const headers = [
    "Tracking #", "Date", "Status", "Payment Status", "Transport Mode", "Payment Method",
    "Hazard", "Customer Code", "Customer",
    "Shipper", "Shipper Phone", "Shipper City", "Shipper Country",
    "Receiver", "Receiver Phone", "Receiver City", "Receiver Province", "Receiver Country",
    "Weight (kg)", "Pieces", "Chargeable (kg)", "Dim Weight (kg)",
    "Base Rate", "Fuel", "Insurance", "Surcharges", "Total", "Currency",
    "Truck Vendor", "Truck Cost", "Category", "Marketing", "Notes",
  ];

  function esc(v: string | null | undefined): string {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  const rows = shipments.map((s) => [
    s.trackingNumber,
    s.createdAt.toISOString().slice(0, 10),
    s.status,
    s.paymentStatus,
    s.transportMode ?? "",
    s.paymentMethod ?? "",
    s.hazardType ?? "",
    s.sender?.userCode ?? "",
    s.sender?.name ?? "",
    s.shipperName,
    s.shipperPhone ?? "",
    s.shipperCity ?? "",
    s.shipperCountry,
    s.receiverName,
    s.receiverPhone ?? "",
    s.receiverCity ?? "",
    s.receiverProvince ?? "",
    s.receiverCountry,
    s.totalWeight.toFixed(2),
    String(s.totalPieces),
    s.chargeableWeight?.toFixed(2) ?? "",
    s.dimensionalWeight?.toFixed(2) ?? "",
    s.baseRate.toFixed(2),
    s.fuelSurcharge.toFixed(2),
    s.insuranceAmount.toFixed(2),
    s.surchargesTotal.toFixed(2),
    s.totalAmount.toFixed(2),
    s.currency,
    s.truckVendor ?? "",
    s.truckCost?.toFixed(2) ?? "",
    s.shipmentCategory ?? "",
    s.marketingTracker ?? "",
    s.notes ?? "",
  ].map(esc).join(","));

  const csv = [headers.join(","), ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kdexpress-shipments-${date}.csv"`,
    },
  });
}
