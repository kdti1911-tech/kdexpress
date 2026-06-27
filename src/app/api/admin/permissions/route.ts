import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildDefaultPermissionsMap, setPermissionsCache } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let entries = await db.rolePermission.findMany();

  if (entries.length === 0) {
    const defaults = buildDefaultPermissionsMap();
    await db.rolePermission.createMany({ data: defaults });
    entries = await db.rolePermission.findMany();
  }

  setPermissionsCache(entries);

  return NextResponse.json({ success: true, entries });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { entries } = await req.json() as {
    entries: { role: string; permission: string; granted: boolean }[];
  };

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany();
    await tx.rolePermission.createMany({ data: entries });
  });

  setPermissionsCache(entries);

  return NextResponse.json({ success: true });
}
