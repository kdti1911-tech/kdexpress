import { db } from "@/lib/db";
import type { RateCalculationInput, RateCalculationResult } from "@/types";

const FUEL_SURCHARGE_RATE = 0.18; // 18% fuel surcharge (adjustable via settings)

export async function calculateRates(
  input: RateCalculationInput
): Promise<RateCalculationResult[]> {
  const { originLocationId, destLocationId, weight, insuranceValue = 0, userGroupId } = input;

  // Find applicable zones: origin matches AND dest is in zone destinations
  const zones = await db.rateZone.findMany({
    where: {
      isActive: true,
      originId: originLocationId,
      destinations: {
        some: { locationId: destLocationId },
      },
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

      const fuelSurcharge = parseFloat(
        (baseRate * FUEL_SURCHARGE_RATE).toFixed(2)
      );

      let insuranceAmount = 0;
      if (insuranceValue > 0) {
        const plan = await db.insurancePlan.findFirst({ where: { isActive: true } });
        if (plan) {
          const clampedValue = Math.min(Math.max(insuranceValue, plan.minValue), plan.maxValue);
          insuranceAmount = parseFloat(
            (clampedValue * (plan.cost / 100)).toFixed(2)
          );
        }
      }

      const totalAmount = parseFloat(
        (baseRate + fuelSurcharge + insuranceAmount).toFixed(2)
      );

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
