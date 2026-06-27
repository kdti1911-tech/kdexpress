import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const upsertSchema = z.object({
  ratePerKg: z.number().positive(),
  note: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userRate = await db.userRate.findUnique({ where: { userId: id } });
  return NextResponse.json({ success: true, data: userRate });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const input = upsertSchema.parse(body);

  const userRate = await db.userRate.upsert({
    where: { userId: id },
    update: input,
    create: { userId: id, ...input },
  });

  return NextResponse.json({ success: true, data: userRate });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await db.userRate.deleteMany({ where: { userId: id } });
  return NextResponse.json({ success: true });
}
