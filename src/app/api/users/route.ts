import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUserCode } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  name: z.string().min(1).transform((s) => s.trim()),
  phone: z.string().optional().transform((s) => s?.trim() || undefined),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE", "DRIVER", "AGENT", "AGENT_VN", "CLIENT"]).default("CLIENT"),
  userCode: z.string().optional().transform((s) => s?.trim().toUpperCase() || undefined),
  branchId: z.string().optional(),
  markup: z.number().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "VIEW_USERS")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));

  const where = {
    ...(role ? { role: role as never } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { userCode: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        userCode: true,
        markup: true,
        isActive: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !can(currentUser.role, "CREATE_USER")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createUserSchema.parse(body);

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already in use" }, { status: 409 });
    }

    // Use provided code or auto-generate unique one
    let userCode = data.userCode;
    if (userCode) {
      if (!/^[A-Z0-9]{4}$/.test(userCode)) {
        return NextResponse.json({ success: false, error: "User code must be exactly 4 alphanumeric characters" }, { status: 400 });
      }
      if (await db.user.findUnique({ where: { userCode } })) {
        return NextResponse.json({ success: false, error: "User code already in use" }, { status: 409 });
      }
    } else {
      let attempts = 0;
      do {
        userCode = generateUserCode();
        if (++attempts > 100) throw new Error("Could not generate unique user code");
      } while (await db.user.findUnique({ where: { userCode } }));
    }

    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone || null,
        passwordHash: await hashPassword(data.password),
        role: data.role,
        userCode,
        branchId: data.branchId || null,
        markup: data.markup,
        isActive: data.isActive,
      },
      select: { id: true, email: true, name: true, role: true, userCode: true },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation failed", details: err.errors }, { status: 400 });
    }
    console.error("Create user error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
