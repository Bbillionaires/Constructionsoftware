import { prisma } from "@/lib/prisma";

/**
 * Seeds a freshly-created company with realistic handyman demo data so a new
 * signup can explore the product immediately. Also used by prisma/seed.ts
 * for the CLI-seeded demo account. This is intentionally idempotent-ish per
 * call (always creates new rows) — only call it once per company.
 */
export async function seedDemoDataForCompany(companyId: string) {
  const categories = await Promise.all(
    [
      { name: "Carpentry", sortOrder: 1 },
      { name: "Drywall & Painting", sortOrder: 2 },
      { name: "Outdoor", sortOrder: 3 },
      { name: "Electrical & Fixtures", sortOrder: 4 },
      { name: "Assembly & General", sortOrder: 5 },
    ].map((c) => prisma.serviceCategory.create({ data: { companyId, ...c } }))
  );

  const [carpentry, drywall, outdoor, electrical, general] = categories;

  await prisma.priceBookItem.createMany({
    data: [
      {
        companyId,
        categoryId: electrical.id,
        name: "TV Mounting",
        description: "Mount a customer-supplied TV up to 75\" on drywall or masonry, conceal cables.",
        standardPrice: 249,
        minimumPrice: 179,
        expectedLaborHours: 1.25,
        expectedCrewSize: 1,
        materialAllowance: 25,
        defaultMarkupPercent: 65,
        targetMarginPercent: 45,
        estimatedDurationMinutes: 75,
        requiredSkills: ["Carpentry", "Electrical"],
        warrantyDays: 365,
      },
      {
        companyId,
        categoryId: drywall.id,
        name: "Drywall Patch (small)",
        description: "Patch holes/dents up to 12x12in, texture and prime.",
        standardPrice: 225,
        minimumPrice: 150,
        expectedLaborHours: 2,
        expectedCrewSize: 1,
        materialAllowance: 20,
        defaultMarkupPercent: 60,
        targetMarginPercent: 45,
        estimatedDurationMinutes: 120,
        requiredSkills: ["Drywall"],
        warrantyDays: 180,
      },
      {
        companyId,
        categoryId: outdoor.id,
        name: "Fence Panel Repair",
        description: "Repair or replace up to 2 damaged fence panels including posts as needed.",
        standardPrice: 650,
        minimumPrice: 450,
        expectedLaborHours: 3,
        expectedCrewSize: 2,
        materialAllowance: 190,
        defaultMarkupPercent: 55,
        targetMarginPercent: 45,
        estimatedDurationMinutes: 180,
        requiredSkills: ["Fence", "Carpentry"],
        warrantyDays: 365,
        permitWarning: null,
      },
      {
        companyId,
        categoryId: outdoor.id,
        name: "Deck Board Repair",
        description: "Replace damaged/rotted deck boards, re-secure structure.",
        standardPrice: 800,
        minimumPrice: 550,
        expectedLaborHours: 4,
        expectedCrewSize: 2,
        materialAllowance: 260,
        defaultMarkupPercent: 50,
        targetMarginPercent: 40,
        estimatedDurationMinutes: 240,
        requiredSkills: ["Carpentry"],
        warrantyDays: 365,
      },
      {
        companyId,
        categoryId: carpentry.id,
        name: "Interior Door Installation",
        description: "Install a customer-supplied pre-hung interior door.",
        standardPrice: 275,
        minimumPrice: 200,
        expectedLaborHours: 2,
        expectedCrewSize: 1,
        materialAllowance: 15,
        defaultMarkupPercent: 55,
        targetMarginPercent: 42,
        estimatedDurationMinutes: 120,
        requiredSkills: ["Carpentry"],
        warrantyDays: 180,
      },
      {
        companyId,
        categoryId: outdoor.id,
        name: "Gutter Cleaning",
        description: "Clean and flush gutters and downspouts, single story.",
        standardPrice: 175,
        minimumPrice: 125,
        expectedLaborHours: 1.5,
        expectedCrewSize: 1,
        materialAllowance: 0,
        defaultMarkupPercent: 70,
        targetMarginPercent: 55,
        estimatedDurationMinutes: 90,
        requiredSkills: [],
        warrantyDays: 30,
      },
      {
        companyId,
        categoryId: electrical.id,
        name: "Ceiling Fan Installation",
        description: "Install customer-supplied ceiling fan, existing electrical box.",
        standardPrice: 225,
        minimumPrice: 165,
        expectedLaborHours: 1.5,
        expectedCrewSize: 1,
        materialAllowance: 10,
        defaultMarkupPercent: 60,
        targetMarginPercent: 45,
        estimatedDurationMinutes: 90,
        requiredSkills: ["Electrical"],
        warrantyDays: 365,
      },
      {
        companyId,
        categoryId: general.id,
        name: "Furniture Assembly",
        description: "Assemble up to 2 flat-pack furniture pieces.",
        standardPrice: 150,
        minimumPrice: 100,
        expectedLaborHours: 1.5,
        expectedCrewSize: 1,
        materialAllowance: 0,
        defaultMarkupPercent: 75,
        targetMarginPercent: 55,
        estimatedDurationMinutes: 90,
        requiredSkills: [],
        warrantyDays: 30,
      },
      {
        companyId,
        categoryId: general.id,
        name: "Shelving Installation",
        description: "Install up to 3 wall-mounted shelves with proper anchoring.",
        standardPrice: 195,
        minimumPrice: 140,
        expectedLaborHours: 1.5,
        expectedCrewSize: 1,
        materialAllowance: 20,
        defaultMarkupPercent: 65,
        targetMarginPercent: 48,
        estimatedDurationMinutes: 90,
        requiredSkills: ["Carpentry"],
        warrantyDays: 180,
      },
      {
        companyId,
        categoryId: drywall.id,
        name: "Interior Room Painting",
        description: "Paint one standard room (walls only), customer-supplied or allowance paint.",
        standardPrice: 650,
        minimumPrice: 450,
        expectedLaborHours: 6,
        expectedCrewSize: 2,
        materialAllowance: 120,
        defaultMarkupPercent: 45,
        targetMarginPercent: 40,
        estimatedDurationMinutes: 360,
        requiredSkills: ["Painting"],
        warrantyDays: 365,
      },
    ],
  });

  const customers = await Promise.all(
    [
      { firstName: "Maria", lastName: "Gonzalez", phone: "555-010-1001", email: "maria.g@example.com" },
      { firstName: "David", lastName: "Chen", phone: "555-010-1002", email: "dchen@example.com" },
      { firstName: "Sarah", lastName: "Thompson", phone: "555-010-1003", email: "sarah.t@example.com" },
      { firstName: "Robert", lastName: "Okafor", phone: "555-010-1004", email: "rokafor@example.com" },
      { firstName: "Linda", lastName: "Martins", phone: "555-010-1005", email: "linda.m@example.com" },
    ].map((c) => prisma.customer.create({ data: { companyId, ...c } }))
  );

  const addresses = [
    { addressLine1: "412 Maple Street", city: "Springfield", state: "OH", postalCode: "45501" },
    { addressLine1: "88 Birchwood Ave", city: "Springfield", state: "OH", postalCode: "45502" },
    { addressLine1: "1290 Lakeview Dr", city: "Springfield", state: "OH", postalCode: "45503" },
    { addressLine1: "56 Orchard Ln", city: "Springfield", state: "OH", postalCode: "45504" },
    { addressLine1: "731 Cedar Ct", city: "Springfield", state: "OH", postalCode: "45505" },
  ];

  const properties = await Promise.all(
    customers.map((c, i) => prisma.property.create({ data: { companyId, customerId: c.id, ...addresses[i] } }))
  );

  const sources = ["PHONE", "GOOGLE", "REFERRAL", "FACEBOOK", "WEBSITE"] as const;
  await Promise.all(
    customers.map((c, i) =>
      prisma.lead.create({
        data: {
          companyId,
          customerId: c.id,
          propertyId: properties[i].id,
          source: sources[i],
          requestedService: ["Fence Repair", "TV Mounting", "Drywall Patch", "Deck Repair", "Gutter Cleaning"][i],
          description: "Demo lead seeded for exploring the CRM pipeline.",
          status: (["NEW", "CONTACTED", "QUALIFIED", "ESTIMATE_SENT", "FOLLOW_UP"] as const)[i],
          estimatedValue: [650, 249, 225, 800, 175][i],
        },
      })
    )
  );

  return { customers, properties };
}
