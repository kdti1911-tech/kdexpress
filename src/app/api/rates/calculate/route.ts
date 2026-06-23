import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { calculateRates, applyUserMarkup } from "@/lib/rates";
import { z } from "zod";

const schema = z.object({
  originLocationId: z.string(),
  destLocationId: z.string(),
  weight: z.number().positive(),
  packages: z.array(
    z.object({
      weight: z.number().positive(),
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
    })
  ),
  insuranceValue: z.number().min(0).default(0),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = schema.parse(body);

    const user = await getCurrentUser();

    const results = await calculateRates({
      ...input,
      userGroupId: undefined,
    });

    const finalResults = user?.markup
      ? await applyUserMarkup(results, user.markup)
      : results;

    return NextResponse.json({ success: true, data: finalResults });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
