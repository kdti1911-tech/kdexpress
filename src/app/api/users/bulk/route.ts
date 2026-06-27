import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  userIds: z.array(z.string()).min(1),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE", "DRIVER", "AGENT", "AGENT_VN", "CLIENT"]),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "MANAGE_BRANCHES")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const { userIds, role } = parsed.data;

  // Prevent demoting self
  const filteredIds = userIds.filter(id => id !== user.id);

  const { count } = await db.user.updateMany({
    where: { id: { in: filteredIds } },
    data: { role },
  });

  return NextResponse.json({ success: true, count });
}
