import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  item: z.string().min(1),
  cost: z.number().min(0).default(0),
  costType: z.enum(["flat", "percent"]).default("flat"),
  percentVal: z.number().min(0).default(0),
  hazardType: z.enum(["NONE","BATTERY_B","BATTERY_BHV","FRAGILE","MAGNETIC","LIQUID","RESCUE"]).nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const surcharges = await db.surcharge.findMany({
    orderBy: [{ sortOrder: "asc" }, { item: "asc" }],
  });
  return NextResponse.json({ success: true, data: surcharges });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const input = createSchema.parse(body);
    const surcharge = await db.surcharge.create({
      data: {
        ...input,
        hazardType: input.hazardType ?? null,
      },
    });
    return NextResponse.json({ success: true, data: surcharge }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
