import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── Branches (from production data) ──────────────────────────────────────
  const branches = await Promise.all([
    db.branch.upsert({
      where: { code: "MIS" },
      update: {},
      create: {
        name: "KDExpress Mississauga",
        code: "MIS",
        phone: "+1 905 000 0001",
        address1: "123 Hurontario St",
        city: "Mississauga",
        province: "ON",
        country: "CA",
        postcode: "L5A 1A1",
        prefix: "MIS",
      },
    }),
    db.branch.upsert({
      where: { code: "TOR" },
      update: {},
      create: {
        name: "KDExpress Toronto",
        code: "TOR",
        phone: "+1 416 000 0001",
        city: "Toronto",
        province: "ON",
        country: "CA",
        prefix: "TOR",
      },
    }),
    db.branch.upsert({
      where: { code: "VAN" },
      update: {},
      create: {
        name: "KDExpress Vancouver",
        code: "VAN",
        phone: "+1 604 000 0001",
        city: "Vancouver",
        province: "BC",
        country: "CA",
        prefix: "VAN",
      },
    }),
    db.branch.upsert({
      where: { code: "HAN" },
      update: {},
      create: {
        name: "KDExpress Hà Nội",
        code: "HAN",
        city: "Hà Nội",
        country: "VN",
        prefix: "HAN",
      },
    }),
    db.branch.upsert({
      where: { code: "HCM" },
      update: {},
      create: {
        name: "KDExpress TP Hồ Chí Minh",
        code: "HCM",
        city: "TP Hồ Chí Minh",
        country: "VN",
        prefix: "HCM",
      },
    }),
  ]);

  const misBranch = branches[0];

  // ── Locations ─────────────────────────────────────────────────────────────
  const locationData = [
    { name: "Vancouver", slug: "vancouver" },
    { name: "Toronto", slug: "toronto" },
    { name: "Vietnam", slug: "vietnam" },
    { name: "Canada", slug: "canada" },
    { name: "Hà Nội", slug: "hanoi" },
    { name: "TP Hồ Chí Minh", slug: "hcmc" },
    { name: "Regina", slug: "regina" },
    { name: "Abbotsford", slug: "abbotsford" },
  ];

  const locations: Record<string, { id: string }> = {};
  for (const loc of locationData) {
    const l = await db.location.upsert({
      where: { slug: loc.slug },
      update: {},
      create: loc,
    });
    locations[loc.slug] = l;
  }

  // ── Delivery Types ────────────────────────────────────────────────────────
  const deliveryTypes = await Promise.all([
    db.deliveryType.upsert({
      where: { id: "dt-economy" },
      update: {},
      create: { id: "dt-economy", title: "Economy", description: "10-15 business days", sortOrder: 1 },
    }),
    db.deliveryType.upsert({
      where: { id: "dt-standard" },
      update: {},
      create: { id: "dt-standard", title: "Standard", description: "7-10 business days", sortOrder: 2 },
    }),
    db.deliveryType.upsert({
      where: { id: "dt-premium" },
      update: {},
      create: { id: "dt-premium", title: "Premium", description: "5-7 business days", sortOrder: 3 },
    }),
  ]);

  // ── Rate Zones ────────────────────────────────────────────────────────────
  // Zone: Vancouver → Vietnam
  const zoneVanVN = await db.rateZone.upsert({
    where: { id: "zone-van-vn" },
    update: {},
    create: {
      id: "zone-van-vn",
      label: "Vancouver → Vietnam",
      originId: locations["vancouver"].id,
      destinations: {
        create: [
          { locationId: locations["vietnam"].id },
          { locationId: locations["hanoi"].id },
          { locationId: locations["hcmc"].id },
        ],
      },
    },
  });

  // Zone: Toronto → Vietnam
  const zoneTorVN = await db.rateZone.upsert({
    where: { id: "zone-tor-vn" },
    update: {},
    create: {
      id: "zone-tor-vn",
      label: "Toronto → Vietnam",
      originId: locations["toronto"].id,
      destinations: {
        create: [
          { locationId: locations["vietnam"].id },
          { locationId: locations["hanoi"].id },
          { locationId: locations["hcmc"].id },
        ],
      },
    },
  });

  // Zone: Vietnam → Vancouver
  const zoneVNVan = await db.rateZone.upsert({
    where: { id: "zone-vn-van" },
    update: {},
    create: {
      id: "zone-vn-van",
      label: "Vietnam → Vancouver",
      originId: locations["vietnam"].id,
      destinations: {
        create: [
          { locationId: locations["vancouver"].id },
          { locationId: locations["canada"].id },
        ],
      },
    },
  });

  // ── Rates (from production data) ──────────────────────────────────────────
  // Vancouver → Vietnam: $14.80/kg Standard
  await db.rate.upsert({
    where: { id: "rate-van-vn-std" },
    update: {},
    create: {
      id: "rate-van-vn-std",
      zoneId: zoneVanVN.id,
      deliveryTypeId: deliveryTypes[1].id,
      brand: "KDExpress",
      service: "Air Cargo",
      rateType: "PER_KG",
      weightCost: 14.80,
      minWeight: 0,
      maxWeight: 9999,
      price: 0,
      rateProtection: 0,
    },
  });

  // Vancouver → Vietnam: $12.00/kg Economy
  await db.rate.upsert({
    where: { id: "rate-van-vn-eco" },
    update: {},
    create: {
      id: "rate-van-vn-eco",
      zoneId: zoneVanVN.id,
      deliveryTypeId: deliveryTypes[0].id,
      brand: "KDExpress",
      service: "Sea Cargo",
      rateType: "PER_KG",
      weightCost: 12.00,
      minWeight: 0,
      maxWeight: 9999,
      price: 0,
    },
  });

  // Toronto → Vietnam: $15.40/kg Standard
  await db.rate.upsert({
    where: { id: "rate-tor-vn-std" },
    update: {},
    create: {
      id: "rate-tor-vn-std",
      zoneId: zoneTorVN.id,
      deliveryTypeId: deliveryTypes[1].id,
      brand: "KDExpress",
      service: "Air Cargo",
      rateType: "PER_KG",
      weightCost: 15.40,
      minWeight: 0,
      maxWeight: 9999,
      price: 0,
    },
  });

  // Toronto → Vietnam: $13.00/kg Economy
  await db.rate.upsert({
    where: { id: "rate-tor-vn-eco" },
    update: {},
    create: {
      id: "rate-tor-vn-eco",
      zoneId: zoneTorVN.id,
      deliveryTypeId: deliveryTypes[0].id,
      brand: "KDExpress",
      service: "Sea Cargo",
      rateType: "PER_KG",
      weightCost: 13.00,
      minWeight: 0,
      maxWeight: 9999,
      price: 0,
    },
  });

  // Vietnam → Canada: $8.00/kg Standard (reverse)
  await db.rate.upsert({
    where: { id: "rate-vn-can-std" },
    update: {},
    create: {
      id: "rate-vn-can-std",
      zoneId: zoneVNVan.id,
      deliveryTypeId: deliveryTypes[1].id,
      brand: "KDExpress",
      service: "Air Cargo",
      rateType: "PER_KG",
      weightCost: 8.00,
      minWeight: 0,
      maxWeight: 9999,
      price: 0,
    },
  });

  // ── Insurance ─────────────────────────────────────────────────────────────
  await db.insurancePlan.upsert({
    where: { id: "ins-default" },
    update: {},
    create: {
      id: "ins-default",
      name: "KDExpress Insurance",
      type: "PERCENTAGE",
      minValue: 100,
      maxValue: 10000,
      coverage: 100,
      cost: 6,
    },
  });

  // ── User Groups ───────────────────────────────────────────────────────────
  await Promise.all([
    db.userGroup.upsert({ where: { id: "ug-agent" }, update: {}, create: { id: "ug-agent", label: "Agent", description: "Local agents" } }),
    db.userGroup.upsert({ where: { id: "ug-employee" }, update: {}, create: { id: "ug-employee", label: "Employee", description: "Staff members" } }),
    db.userGroup.upsert({ where: { id: "ug-highvol" }, update: {}, create: { id: "ug-highvol", label: "High Volume Clients", description: "Clients with high volume discounts" } }),
    db.userGroup.upsert({ where: { id: "ug-agent-vn" }, update: {}, create: { id: "ug-agent-vn", label: "Agent VN", description: "Vietnamese agents" } }),
  ]);

  // ── Default Admin User ────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("admin123!", 12);
  await db.user.upsert({
    where: { email: "admin@kdexpress.ca" },
    update: {},
    create: {
      email: "admin@kdexpress.ca",
      name: "KDExpress Admin",
      passwordHash: adminPassword,
      role: "ADMIN",
      branchId: misBranch.id,
      userCode: "ADMN",
    },
  });

  // Default Manager
  const managerPassword = await bcrypt.hash("manager123!", 12);
  await db.user.upsert({
    where: { email: "manager@kdexpress.ca" },
    update: {},
    create: {
      email: "manager@kdexpress.ca",
      name: "Branch Manager",
      passwordHash: managerPassword,
      role: "MANAGER",
      branchId: misBranch.id,
      userCode: "MNGR",
    },
  });

  // Demo client
  const clientPassword = await bcrypt.hash("client123!", 12);
  await db.user.upsert({
    where: { email: "demo@kdexpress.ca" },
    update: {},
    create: {
      email: "demo@kdexpress.ca",
      name: "Demo Client",
      passwordHash: clientPassword,
      role: "CLIENT",
      userCode: "DEMO",
    },
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  await db.setting.upsert({
    where: { key: "company_name" },
    update: {},
    create: { key: "company_name", value: "KDExpress" },
  });
  await db.setting.upsert({
    where: { key: "fuel_surcharge_rate" },
    update: {},
    create: { key: "fuel_surcharge_rate", value: 0.18 },
  });
  await db.setting.upsert({
    where: { key: "default_currency" },
    update: {},
    create: { key: "default_currency", value: "CAD" },
  });

  console.log("✅ Seed complete");
  console.log("   Admin:   admin@kdexpress.ca / admin123!");
  console.log("   Manager: manager@kdexpress.ca / manager123!");
  console.log("   Client:  demo@kdexpress.ca / client123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
