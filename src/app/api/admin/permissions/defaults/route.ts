import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildDefaultPermissionsMap, setPermissionsCache } from "@/lib/permissions";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const defaults = buildDefaultPermissionsMap();

  await db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany();
    await tx.rolePermission.createMany({ data: defaults });
  });

  setPermissionsCache(defaults);

  return NextResponse.json({ success: true, entries: defaults });
}
