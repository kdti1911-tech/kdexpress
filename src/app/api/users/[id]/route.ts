import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).transform((s) => s.trim()).optional(),
  email: z.string().email().transform((s) => s.trim().toLowerCase()).optional(),
  phone: z.string().optional().transform((s) => s?.trim() || undefined),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(["ADMIN","MANAGER","EMPLOYEE","DRIVER","AGENT","AGENT_VN","CLIENT"]).optional(),
  userCode: z.string().optional().transform((s) => s?.trim().toUpperCase() || undefined),
  branchId: z.string().optional().nullable(),
  markup: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !can(currentUser.role, "VIEW_USERS")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      userCode: true,
      markup: true,
      isActive: true,
      branchId: true,
      createdAt: true,
      branch: { select: { id: true, name: true, code: true } },
      _count: { select: { shipmentsSender: true } },
    },
  });

  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !can(currentUser.role, "EDIT_USER")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const target = await db.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    // Non-admins cannot edit admins
    if (target.role === "ADMIN" && currentUser.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (data.email && data.email !== target.email) {
      const conflict = await db.user.findUnique({ where: { email: data.email } });
      if (conflict) return NextResponse.json({ success: false, error: "Email already in use" }, { status: 409 });
    }

    if (data.userCode) {
      if (!/^[A-Z0-9]{4}$/.test(data.userCode)) {
        return NextResponse.json({ success: false, error: "User code must be exactly 4 alphanumeric characters" }, { status: 400 });
      }
      if (data.userCode !== target.userCode) {
        const conflict = await db.user.findUnique({ where: { userCode: data.userCode } });
        if (conflict) return NextResponse.json({ success: false, error: "User code already in use" }, { status: 409 });
      }
    }

    // Build update payload
    const update: Record<string, unknown> = {};
    if (data.name !== undefined)     update.name = data.name;
    if (data.email !== undefined)    update.email = data.email;
    if (data.phone !== undefined)    update.phone = data.phone || null;
    if (data.role !== undefined)     update.role = data.role;
    if (data.userCode !== undefined) update.userCode = data.userCode;
    if (data.branchId !== undefined) update.branchId = data.branchId || null;
    if (data.markup !== undefined)   update.markup = data.markup;
    if (data.isActive !== undefined) update.isActive = data.isActive;
    if (data.password)               update.passwordHash = await hashPassword(data.password);

    const updated = await db.user.update({
      where: { id },
      data: update,
      select: { id: true, name: true, email: true, role: true, userCode: true, isActive: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Update user error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !can(currentUser.role, "DELETE_USER")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === currentUser.id) {
    return NextResponse.json({ success: false, error: "Cannot delete your own account" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  await db.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
