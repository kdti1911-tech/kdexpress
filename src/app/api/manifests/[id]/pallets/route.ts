import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "UPDATE_STATUS")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id: manifestId } = await params;

  const manifest = await db.manifest.findUnique({ where: { id: manifestId }, select: { status: true, code: true, _count: { select: { pallets: true } } } });
  if (!manifest) return NextResponse.json({ success: false, error: "Manifest not found" }, { status: 404 });
  if (!["PLANNING", "LOADING"].includes(manifest.status)) {
    return NextResponse.json({ success: false, error: "Cannot add pallets to a sealed/dispatched manifest" }, { status: 400 });
  }

  const { destination, notes } = await req.json();

  const palletNum = String(manifest._count.pallets + 1).padStart(3, "0");
  const code = `${manifest.code}-P${palletNum}`;

  const pallet = await db.pallet.create({
    data: {
      code,
      manifestId,
      destination: destination || null,
      notes: notes || null,
    },
  });

  // Transition manifest to LOADING if still PLANNING
  if (manifest.status === "PLANNING") {
    await db.manifest.update({ where: { id: manifestId }, data: { status: "LOADING" } });
  }

  return NextResponse.json({ success: true, data: pallet });
}
