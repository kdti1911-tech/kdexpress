import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  transportMode: z.enum(["AIR", "SEA", "TRUCK", "LOCAL_MOVING", "AIR_CANADA", "FAST_TRACK"]).optional(),
  originBranchId: z.string().optional().nullable(),
  destBranchId: z.string().optional().nullable(),
  departureDate: z.string().optional().nullable(),
  arrivalDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "VIEW_ALL_SHIPMENTS")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const manifest = await db.manifest.findUnique({
    where: { id },
    include: {
      originBranch: { select: { id: true, name: true, code: true } },
      destBranch:   { select: { id: true, name: true, code: true } },
      createdBy:    { select: { id: true, name: true } },
      pallets: {
        orderBy: { createdAt: "asc" },
        include: {
          packages: {
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
  });

  if (!manifest) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: manifest });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "MANAGE_BRANCHES")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const d = parsed.data;
  const manifest = await db.manifest.update({
    where: { id },
    data: {
      ...(d.transportMode ? { transportMode: d.transportMode as never } : {}),
      ...(d.originBranchId !== undefined ? { originBranchId: d.originBranchId } : {}),
      ...(d.destBranchId !== undefined ? { destBranchId: d.destBranchId } : {}),
      ...(d.departureDate !== undefined ? { departureDate: d.departureDate ? new Date(d.departureDate) : null } : {}),
      ...(d.arrivalDate !== undefined ? { arrivalDate: d.arrivalDate ? new Date(d.arrivalDate) : null } : {}),
      ...(d.notes !== undefined ? { notes: d.notes } : {}),
    },
  });

  return NextResponse.json({ success: true, data: manifest });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const manifest = await db.manifest.findUnique({ where: { id } });
  if (!manifest) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  await db.manifest.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
