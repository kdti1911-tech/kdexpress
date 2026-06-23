import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const locations = await db.location.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ success: true, data: locations });
}
