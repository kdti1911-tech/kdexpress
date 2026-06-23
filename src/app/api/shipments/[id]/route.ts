import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ShipmentStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const updateStatusSchema = z.object({
  status: z.enum([
    "PENDING", "CONFIRMED", "PICKED_UP", "IN_TRANSIT",
    "ARRIVED_ORIGIN", "CUSTOMS_CLEARANCE", "ARRIVED_DESTINATION",
    "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "LOST",
  ]),
  note: z.string().optional(),
  location: z.string().optional(),
});

const updateSchema = z.object({
  status: z.enum([
    "PENDING", "CONFIRMED", "PICKED_UP", "IN_TRANSIT",
    "ARRIVED_ORIGIN", "CUSTOMS_CLEARANCE", "ARRIVED_DESTINATION",
    "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "LOST",
  ]).optional(),
  note: z.string().optional(),
  location: z.string().optional(),
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID", "REFUNDED"]).optional(),
  internalNotes: z.string().optional(),
  carrierName: z.string().optional(),
  carrierTrackNum: z.string().optional(),
  freightcomId: z.string().optional(),
  labelUrl: z.string().optional(),
  expectedDelivery: z.string().optional(),
  deliveredAt: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const shipment = await db.shipment.findUnique({
    where: { id },
    include: {
      packages: { orderBy: { sequence: "asc" } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      surcharges: { include: { surcharge: true } },
      customFields: { include: { field: true } },
      sender: { select: { id: true, name: true, email: true, phone: true, userCode: true } },
      originBranch: { select: { id: true, name: true, code: true } },
      destBranch: { select: { id: true, name: true, code: true } },
    },
  });

  if (!shipment) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  // Clients can only see their own shipments
  if (["CLIENT", "AGENT", "AGENT_VN"].includes(user.role) && shipment.senderId !== user.id) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: shipment });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (["CLIENT"].includes(user.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    const data = updateSchema.parse(body);

    const newStatus = data.status as ShipmentStatus | undefined;
    const newPaymentStatus = data.paymentStatus as PaymentStatus | undefined;

    const shipment = await db.shipment.update({
      where: { id },
      data: {
        ...(newStatus ? { status: newStatus } : {}),
        ...(newPaymentStatus ? { paymentStatus: newPaymentStatus } : {}),
        ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes } : {}),
        ...(data.carrierName !== undefined ? { carrierName: data.carrierName } : {}),
        ...(data.carrierTrackNum !== undefined ? { carrierTrackNum: data.carrierTrackNum } : {}),
        ...(data.freightcomId !== undefined ? { freightcomId: data.freightcomId } : {}),
        ...(data.labelUrl !== undefined ? { labelUrl: data.labelUrl } : {}),
        ...(data.expectedDelivery ? { expectedDelivery: new Date(data.expectedDelivery) } : {}),
        ...(data.deliveredAt ? { deliveredAt: new Date(data.deliveredAt) } : {}),
        ...(newStatus === "DELIVERED" && !data.deliveredAt ? { deliveredAt: new Date() } : {}),
        ...(newStatus
          ? {
              statusHistory: {
                create: {
                  status: newStatus,
                  note: data.note,
                  location: data.location,
                  updatedById: user.id,
                },
              },
            }
          : {}),
      },
    });

    return NextResponse.json({ success: true, data: shipment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
