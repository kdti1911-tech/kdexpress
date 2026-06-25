import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateTrackingNumber } from "@/lib/utils";
import { z } from "zod";

const packageSchema = z.object({
  description: z.string().optional(),
  weight: z.number().positive(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  value: z.number().min(0).optional(),
  isFragile: z.boolean().default(false),
  isDangerous: z.boolean().default(false),
});

const createSchema = z.object({
  shipmentType: z.enum(["DOCUMENT", "PARCEL", "FREIGHT", "PALLET"]).default("PARCEL"),
  shipperName: z.string().min(1),
  shipperPhone: z.string().optional(),
  shipperEmail: z.string().email().optional().or(z.literal("")),
  shipperAddress: z.string().optional(),
  shipperCity: z.string().optional(),
  shipperProvince: z.string().optional(),
  shipperPostcode: z.string().optional(),
  shipperCountry: z.string().default("CA"),
  receiverName: z.string().min(1),
  receiverPhone: z.string().optional(),
  receiverEmail: z.string().email().optional().or(z.literal("")),
  receiverAddress: z.string().optional(),
  receiverCity: z.string().optional(),
  receiverProvince: z.string().optional(),
  receiverPostcode: z.string().optional(),
  receiverCountry: z.string().default("VN"),
  packages: z.array(packageSchema).min(1),
  rateId: z.string().optional(),
  deliveryTypeId: z.string().optional(),
  baseRate: z.number().min(0).default(0),
  fuelSurcharge: z.number().min(0).default(0),
  insuranceValue: z.number().min(0).default(0),
  insuranceAmount: z.number().min(0).default(0),
  surchargeIds: z.array(z.string()).default([]),
  pickupDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  customFields: z.record(z.string()).default({}),
  originBranchId: z.string().optional(),
  destBranchId: z.string().optional(),
  transportMode: z.enum(["AIR","SEA","TRUCK","LOCAL_MOVING","AIR_CANADA","FAST_TRACK"]).optional(),
  paymentMethod: z.enum(["PENDING","PAY_IN_VIETNAM","PAY_IN_CANADA","PAID_OK2SHIP","CASH","ETRANSFER","CARD"]).optional(),
  hazardType: z.enum(["NONE","BATTERY_B","BATTERY_BHV","FRAGILE","MAGNETIC","LIQUID","RESCUE"]).optional(),
  deliveryMethod: z.enum(["COLLECT_AT_OFFICE","HOME_DELIVERY"]).optional(),
  truckVendor: z.enum(["VITRAN","FREIGHTCOM","DIAMOND_DELIVERY","CVC","KTX","KDEXPRESS"]).optional(),
  truckCost: z.number().min(0).optional(),
  marketingTracker: z.enum(["WALK_IN","PAGE","FB_AD","HOTLINE"]).optional(),
  dimensionalWeight: z.number().min(0).optional(),
  chargeableWeight: z.number().min(0).optional(),
  agentId: z.string().optional(),
  shipmentCategory: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";

  const where = {
    ...(["CLIENT", "AGENT", "AGENT_VN"].includes(user.role)
      ? { senderId: user.id }
      : {}),
    ...(status ? { status: status as never } : {}),
    ...(search
      ? {
          OR: [
            { trackingNumber: { contains: search, mode: "insensitive" as const } },
            { shipperName: { contains: search, mode: "insensitive" as const } },
            { receiverName: { contains: search, mode: "insensitive" as const } },
            { shipperPhone: { contains: search, mode: "insensitive" as const } },
            { receiverPhone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.shipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        paymentStatus: true,
        shipperName: true,
        shipperCountry: true,
        receiverName: true,
        receiverCountry: true,
        totalWeight: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        expectedDelivery: true,
        transportMode: true,
        paymentMethod: true,
        hazardType: true,
        shipmentCategory: true,
        sender: { select: { id: true, name: true, userCode: true } },
      },
    }),
    db.shipment.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const totalWeight = data.packages.reduce((sum, p) => sum + p.weight, 0);
    const totalPieces = data.packages.length;

    // Calculate shipping total
    const surchargesTotal =
      data.surchargeIds.length > 0
        ? (
            await db.surcharge.findMany({
              where: { id: { in: data.surchargeIds }, isActive: true },
            })
          ).reduce((sum, s) => sum + s.cost, 0)
        : 0;

    const userMarkup = user.markup ?? 0;
    const subtotal = data.baseRate + data.fuelSurcharge + data.insuranceAmount + surchargesTotal;
    const totalAmount = parseFloat(
      (subtotal * (1 + userMarkup / 100)).toFixed(2)
    );

    const trackingNumber = generateTrackingNumber(user.userCode);

    const shipment = await db.shipment.create({
      data: {
        trackingNumber,
        shipmentType: data.shipmentType,
        senderId: user.id,
        originBranchId: data.originBranchId ?? user.branchId ?? undefined,
        destBranchId: data.destBranchId,
        shipperName: data.shipperName,
        shipperPhone: data.shipperPhone,
        shipperEmail: data.shipperEmail || null,
        shipperAddress: data.shipperAddress,
        shipperCity: data.shipperCity,
        shipperProvince: data.shipperProvince,
        shipperPostcode: data.shipperPostcode,
        shipperCountry: data.shipperCountry,
        receiverName: data.receiverName,
        receiverPhone: data.receiverPhone,
        receiverEmail: data.receiverEmail || null,
        receiverAddress: data.receiverAddress,
        receiverCity: data.receiverCity,
        receiverProvince: data.receiverProvince,
        receiverPostcode: data.receiverPostcode,
        receiverCountry: data.receiverCountry,
        totalWeight,
        totalPieces,
        rateId: data.rateId,
        deliveryTypeId: data.deliveryTypeId,
        baseRate: data.baseRate,
        fuelSurcharge: data.fuelSurcharge,
        insuranceAmount: data.insuranceAmount,
        insuranceValue: data.insuranceValue,
        surchargesTotal,
        totalAmount,
        userMarkup,
        notes: data.notes,
        internalNotes: data.internalNotes,
        pickupDate: data.pickupDate ? new Date(data.pickupDate) : null,
        expectedDelivery: data.expectedDelivery
          ? new Date(data.expectedDelivery)
          : null,
        packages: {
          create: data.packages.map((p, i) => ({
            sequence: i + 1,
            trackingNumber: `${trackingNumber}-${String(i + 1).padStart(2, "0")}`,
            description: p.description,
            weight: p.weight,
            length: p.length,
            width: p.width,
            height: p.height,
            value: p.value,
            isFragile: p.isFragile,
            isDangerous: p.isDangerous,
          })),
        },
        statusHistory: {
          create: {
            status: "PENDING",
            note: "Shipment created",
            updatedById: user.id,
          },
        },
        surcharges: {
          create: data.surchargeIds.map((surchargeId) => ({
            surchargeId,
            amount: 0,
            quantity: 1,
          })),
        },
        customFields: {
          create: Object.entries(data.customFields).map(([fieldId, value]) => ({
            fieldId,
            value,
          })),
        },
        transportMode: data.transportMode,
        paymentMethod: data.paymentMethod,
        hazardType: data.hazardType,
        deliveryMethod: data.deliveryMethod,
        truckVendor: data.truckVendor,
        truckCost: data.truckCost,
        marketingTracker: data.marketingTracker,
        dimensionalWeight: data.dimensionalWeight,
        chargeableWeight: data.chargeableWeight,
        agentId: data.agentId,
        shipmentCategory: data.shipmentCategory,
      },
    });

    // Auto-save shipper and receiver to address book (name+phone dedup)
    const saveContact = async (
      type: "shipper" | "receiver",
      name: string,
      phone: string | undefined,
      email: string | null | undefined,
      address: string | undefined,
      city: string | undefined,
      province: string | undefined,
      postcode: string | undefined,
      country: string,
    ) => {
      const normalizedName = name.trim();
      const normalizedPhone = phone?.trim() || undefined;
      if (!normalizedName) return;
      const existing = await db.addressBook.findFirst({
        where: {
          userId: user.id,
          type,
          name: { equals: normalizedName, mode: "insensitive" },
          phone: normalizedPhone ? { equals: normalizedPhone } : null,
        },
      });
      if (!existing) {
        await db.addressBook.create({
          data: { userId: user.id, type, name: normalizedName, phone: normalizedPhone || null, email: email || null, address, city, province, postcode, country },
        }).catch(() => {}); // ignore race-condition duplicates
      }
    };

    await Promise.all([
      saveContact("shipper", data.shipperName, data.shipperPhone, data.shipperEmail, data.shipperAddress, data.shipperCity, data.shipperProvince, data.shipperPostcode, data.shipperCountry),
      saveContact("receiver", data.receiverName, data.receiverPhone, data.receiverEmail, data.receiverAddress, data.receiverCity, data.receiverProvince, data.receiverPostcode, data.receiverCountry),
    ]);

    return NextResponse.json(
      { success: true, data: { id: shipment.id, trackingNumber } },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: err.errors },
        { status: 400 }
      );
    }
    console.error("Create shipment error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
