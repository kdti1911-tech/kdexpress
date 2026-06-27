import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const deleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

const assignSchema = z.object({
  ids: z.array(z.string()).min(1),
  senderId: z.string(),
});

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "MANAGE_BRANCHES")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const { count } = await db.shipment.deleteMany({
    where: { id: { in: parsed.data.ids } },
  });

  return NextResponse.json({ success: true, count });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "MANAGE_BRANCHES")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const { ids, senderId } = parsed.data;

  const sender = await db.user.findUnique({ where: { id: senderId }, select: { id: true } });
  if (!sender) {
    return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
  }

  const { count } = await db.shipment.updateMany({
    where: { id: { in: ids } },
    data: { senderId },
  });

  return NextResponse.json({ success: true, count });
}
