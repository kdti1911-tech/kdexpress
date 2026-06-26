import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

type Params = { params: Promise<{ id: string; palletId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "UPDATE_STATUS")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { palletId } = await params;
  const { destination, notes, status } = await req.json();

  const pallet = await db.pallet.findUnique({ where: { id: palletId }, select: { status: true } });
  if (!pallet) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const updated = await db.pallet.update({
    where: { id: palletId },
    data: {
      ...(destination !== undefined ? { destination } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(status === "SEALED" && pallet.status === "OPEN" ? { status: "SEALED", sealedAt: new Date() } : {}),
      ...(status === "OPEN" && pallet.status === "SEALED" ? { status: "OPEN", sealedAt: null } : {}),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "MANAGE_BRANCHES")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { palletId } = await params;

  const pallet = await db.pallet.findUnique({
    where: { id: palletId },
    select: { status: true, _count: { select: { packages: true } } },
  });
  if (!pallet) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  await db.pallet.delete({ where: { id: palletId } });
  return NextResponse.json({ success: true });
}
