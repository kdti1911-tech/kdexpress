import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { calcVolumeWeight, calcFreight, getUserRate } from "@/lib/rates";
import { z } from "zod";

const schema = z.object({
  packages: z.array(
    z.object({
      weight: z.number().min(0),
      length: z.number().min(0).optional(),
      width: z.number().min(0).optional(),
      height: z.number().min(0).optional(),
    })
  ).min(1),
  userId: z.string().optional(),   // sender/customer id
  ratePerKg: z.number().positive().optional(), // manual override
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const input = schema.parse(body);

    const grossWeight = input.packages.reduce((s, p) => s + p.weight, 0);
    const volumeWeight = calcVolumeWeight(input.packages);

    // Resolve rate: manual override > user custom rate > null (no public default)
    let ratePerKg = input.ratePerKg ?? null;
    let rateSource: "manual" | "custom" | "none" = "none";

    if (ratePerKg != null) {
      rateSource = "manual";
    } else if (input.userId) {
      const customRate = await getUserRate(input.userId);
      if (customRate != null) {
        ratePerKg = customRate;
        rateSource = "custom";
      }
    }

    if (ratePerKg == null) {
      return NextResponse.json({
        success: true,
        data: { grossWeight, volumeWeight, ratePerKg: null, rateSource, breakdown: null },
      });
    }

    const breakdown = calcFreight(grossWeight, volumeWeight, ratePerKg);
    return NextResponse.json({
      success: true,
      data: { grossWeight, volumeWeight, ratePerKg, rateSource, breakdown },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
