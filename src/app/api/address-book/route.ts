import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const saveSchema = z.object({
  type: z.enum(["shipper", "receiver"]),
  name: z.string().min(1).transform((s) => s.trim()),
  phone: z.string().optional().transform((s) => s?.trim() || undefined),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().default("VN"),
  isDefault: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type") ?? "";

  const where = {
    // Staff can see all; clients see only their own
    ...(!["ADMIN", "MANAGER", "EMPLOYEE"].includes(user.role)
      ? { userId: user.id }
      : {}),
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const entries = await db.addressBook.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    take: 20,
    select: {
      id: true,
      type: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      province: true,
      postcode: true,
      country: true,
      isDefault: true,
    },
  });

  return NextResponse.json({ success: true, data: entries });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = saveSchema.parse(body);

    // If marking as default, unset previous default for same type
    if (data.isDefault) {
      await db.addressBook.updateMany({
        where: { userId: user.id, type: data.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check for duplicate (same name + phone)
    const existing = await db.addressBook.findFirst({
      where: {
        userId: user.id,
        type: data.type,
        name: { equals: data.name, mode: "insensitive" },
        phone: data.phone ?? null,
      },
    });

    if (existing) {
      // Update existing instead of creating duplicate
      const updated = await db.addressBook.update({
        where: { id: existing.id },
        data: { ...data, email: data.email || null },
      });
      return NextResponse.json({ success: true, data: updated, updated: true });
    }

    const entry = await db.addressBook.create({
      data: { ...data, userId: user.id, email: data.email || null },
    });
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Address book error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
