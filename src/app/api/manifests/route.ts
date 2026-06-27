import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";

function generateManifestCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `MNF-${y}-${m}-${rand}`;
}

const createSchema = z.object({
  transportMode: z.enum(["AIR", "SEA", "TRUCK", "LOCAL_MOVING", "AIR_CANADA", "FAST_TRACK"]),
  originBranchId: z.string().optional(),
  destBranchId: z.string().optional(),
  departureDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "VIEW_ALL_SHIPMENTS")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));

  // Support comma-separated statuses: ?status=PLANNING,LOADING
  const statuses = statusParam ? statusParam.split(",").map(s => s.trim()).filter(Boolean) : [];
  const where = statuses.length > 0 ? { status: { in: statuses as never[] } } : {};

  const [manifests, total] = await Promise.all([
    db.manifest.findMany({
      where,
      include: {
        originBranch: { select: { name: true, code: true } },
        destBranch: { select: { name: true, code: true } },
        _count: { select: { pallets: true } },
        pallets: {
          select: {
            id: true,
            code: true,
            status: true,
            _count: { select: { packages: true } },
            packages: { select: { package: { select: { weight: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.manifest.count({ where }),
  ]);

  const items = manifests.map((m) => {
    const totalPieces = m.pallets.reduce((sum, p) => sum + p._count.packages, 0);
    const totalWeight = m.pallets.reduce(
      (sum, p) => sum + p.packages.reduce((s, pp) => s + (pp.package.weight ?? 0), 0),
      0
    );
    const pallets = m.pallets.map(p => ({ id: p.id, code: p.code, status: p.status }));
    return { ...m, pallets, totalPieces, totalWeight, palletCount: m._count.pallets };
  });

  return NextResponse.json({ success: true, data: { items, total, page, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "MANAGE_BRANCHES")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const d = parsed.data;

  // Generate unique manifest code
  let code = generateManifestCode();
  for (let i = 0; i < 10; i++) {
    const exists = await db.manifest.findUnique({ where: { code } });
    if (!exists) break;
    code = generateManifestCode();
  }

  const manifest = await db.manifest.create({
    data: {
      code,
      transportMode: d.transportMode as never,
      originBranchId: d.originBranchId || null,
      destBranchId: d.destBranchId || null,
      departureDate: d.departureDate ? new Date(d.departureDate) : null,
      arrivalDate: d.arrivalDate ? new Date(d.arrivalDate) : null,
      notes: d.notes || null,
      createdById: user.id,
    },
  });

  return NextResponse.json({ success: true, data: manifest });
}
