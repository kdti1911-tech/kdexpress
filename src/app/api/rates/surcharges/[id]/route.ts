import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  item: z.string().min(1).optional(),
  cost: z.number().min(0).optional(),
  costType: z.enum(["flat", "percent"]).optional(),
  percentVal: z.number().min(0).optional(),
  hazardType: z.enum(["NONE","BATTERY_B","BATTERY_BHV","FRAGILE","MAGNETIC","LIQUID","RESCUE"]).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const input = updateSchema.parse(body);
    const surcharge = await db.surcharge.update({ where: { id }, data: input });
    return NextResponse.json({ success: true, data: surcharge });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await db.surcharge.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
