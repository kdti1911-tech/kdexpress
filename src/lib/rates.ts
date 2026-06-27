import { db } from "@/lib/db";
import type { RateCalculationInput, RateCalculationResult } from "@/types";
import { VOLUME_DIVISOR, VOLUME_EXCESS_RATE } from "@/lib/freight-config";

export { VOLUME_DIVISOR, VOLUME_EXCESS_RATE };

const FUEL_SURCHARGE_RATE = 0.18; // 18% fuel surcharge

// Calculate total volume weight from package dimensions (cm → kg via /6000)
export function calcVolumeWeight(
  packages: { length?: number | null; width?: number | null; height?: number | null }[]
): number {
  return packages.reduce((sum, p) => {
    const l = p.length ?? 0;
    const w = p.width ?? 0;
    const h = p.height ?? 0;
    return l > 0 && w > 0 && h > 0 ? sum + (l * w * h) / VOLUME_DIVISOR : sum;
  }, 0);
}

// Freight formula:
//   base freight  = grossWeight × ratePerKg
//   vol surcharge = max(0, volumeWeight - grossWeight) × VOLUME_EXCESS_RATE ($4)
//   total         = base freight + vol surcharge
export function calcFreight(
  grossWeight: number,
  volumeWeight: number,
  ratePerKg: number
): {
  grossWeight: number;
  volumeWeight: number;
  baseFreight: number;
  volumeSurcharge: number;
  totalFreight: number;
} {
  const baseFreight = parseFloat((grossWeight * ratePerKg).toFixed(2));
  const excess = Math.max(0, volumeWeight - grossWeight);
  const volumeSurcharge = parseFloat((excess * VOLUME_EXCESS_RATE).toFixed(2));
  return {
    grossWeight,
    volumeWeight: parseFloat(volumeWeight.toFixed(3)),
    baseFreight,
    volumeSurcharge,
    totalFreight: parseFloat((baseFreight + volumeSurcharge).toFixed(2)),
  };
}

// Fetch the custom rate per kg assigned to a user (null = use public rate)
export async function getUserRate(userId: string): Promise<number | null> {
  const userRate = await db.userRate.findUnique({ where: { userId } });
  return userRate?.isActive ? userRate.ratePerKg : null;
}

// ─── EXISTING ZONE-BASED RATE CALCULATOR ──────────────────────────────────

export async function calculateRates(
  input: RateCalculationInput
): Promise<RateCalculationResult[]> {
  const { originLocationId, destLocationId, weight, insuranceValue = 0, userGroupId } = input;

  const zones = await db.rateZone.findMany({
    where: {
      isActive: true,
      originId: originLocationId,
      destinations: { some: { locationId: destLocationId } },
    },
    include: {
      rates: {
        where: {
          isActive: true,
          minWeight: { lte: weight },
          maxWeight: { gte: weight },
          ...(userGroupId
            ? {
                OR: [
                  { userGroups: { none: {} } },
                  { userGroups: { some: { userGroupId } } },
                ],
              }
            : { userGroups: { none: {} } }),
        },
        include: { deliveryType: true },
      },
    },
  });

  const results: RateCalculationResult[] = [];

  for (const zone of zones) {
    for (const rate of zone.rates) {
      let baseRate = 0;
      if (rate.rateType === "PER_KG") {
        baseRate = weight * rate.weightCost + rate.price;
      } else if (rate.rateType === "FLAT") {
        baseRate = rate.price;
      } else {
        baseRate = weight * rate.price;
      }

      const fuelSurcharge = parseFloat((baseRate * FUEL_SURCHARGE_RATE).toFixed(2));

      let insuranceAmount = 0;
      if (insuranceValue > 0) {
        const plan = await db.insurancePlan.findFirst({ where: { isActive: true } });
        if (plan) {
          const clampedValue = Math.min(Math.max(insuranceValue, plan.minValue), plan.maxValue);
          insuranceAmount = parseFloat((clampedValue * (plan.cost / 100)).toFixed(2));
        }
      }

      const totalAmount = parseFloat((baseRate + fuelSurcharge + insuranceAmount).toFixed(2));

      results.push({
        rateId: rate.id,
        deliveryTypeId: rate.deliveryTypeId,
        deliveryTypeTitle: rate.deliveryType.title,
        brand: rate.brand,
        service: rate.service,
        baseRate,
        fuelSurcharge,
        insuranceAmount,
        surchargesTotal: 0,
        totalAmount,
        currency: "CAD",
        logoUrl: rate.logoUrl,
      });
    }
  }

  return results.sort((a, b) => a.totalAmount - b.totalAmount);
}

export async function applyUserMarkup(
  results: RateCalculationResult[],
  markupPercent: number
): Promise<RateCalculationResult[]> {
  if (markupPercent <= 0) return results;
  return results.map((r) => {
    const markupAmount = r.totalAmount * (markupPercent / 100);
    return {
      ...r,
      totalAmount: parseFloat((r.totalAmount + markupAmount).toFixed(2)),
    };
  });
}
