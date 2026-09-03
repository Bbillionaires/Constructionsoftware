import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { seedDemoDataForCompany } from "../src/lib/seed-demo";
import { convertEstimateToJob } from "../src/lib/estimate-to-job";
import { computeJobCost } from "../src/lib/job-costing";
import { generateInvoiceForJob } from "../src/lib/invoice-generation";
import { recordPartialPayment } from "../src/lib/payments-record";
import { nextEstimateNumber, nextJobNumber } from "../src/lib/numbering";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

async function main() {
  console.log("Seeding Contractor OS demo account…");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const company = await prisma.company.upsert({
    where: { slug: "greenwood-handyman" },
    update: {},
    create: {
      name: "Greenwood Handyman Co.",
      slug: "greenwood-handyman",
      phone: "(555) 200-4100",
      email: "office@greenwoodhandyman.example",
      addressLine1: "500 Main Street",
      city: "Springfield",
      state: "OH",
      postalCode: "45500",
      targetMarginPercent: 45,
      defaultLaborRate: 35,
    },
  });

  const existing = await prisma.companyMember.findFirst({ where: { companyId: company.id } });
  if (existing) {
    console.log("Demo company already seeded — skipping (delete the company to reseed).");
    return;
  }

  const [owner, estimator, office, techJohn, techMike] = await Promise.all([
    prisma.user.create({
      data: { name: "Olivia Owner", email: "owner@greenwoodhandyman.example", passwordHash },
    }),
    prisma.user.create({
      data: { name: "Eddie Estimator", email: "estimator@greenwoodhandyman.example", passwordHash },
    }),
    prisma.user.create({
      data: { name: "Olga Office", email: "office@greenwoodhandyman.example", passwordHash },
    }),
    prisma.user.create({
      data: { name: "John Martinez", email: "john@greenwoodhandyman.example", passwordHash },
    }),
    prisma.user.create({
      data: { name: "Mike Sullivan", email: "mike@greenwoodhandyman.example", passwordHash },
    }),
  ]);

  await prisma.companyMember.createMany({
    data: [
      { companyId: company.id, userId: owner.id, role: "OWNER" },
      { companyId: company.id, userId: estimator.id, role: "ESTIMATOR" },
      { companyId: company.id, userId: office.id, role: "OFFICE" },
      { companyId: company.id, userId: techJohn.id, role: "TECHNICIAN" },
      { companyId: company.id, userId: techMike.id, role: "TECHNICIAN" },
    ],
  });

  const [johnTech, mikeTech] = await Promise.all([
    prisma.technician.create({ data: { companyId: company.id, userId: techJohn.id, hourlyCostRate: 28, colorHex: "#2563eb" } }),
    prisma.technician.create({ data: { companyId: company.id, userId: techMike.id, hourlyCostRate: 26, colorHex: "#16a34a" } }),
  ]);

  await Promise.all([
    prisma.technicianSkill.createMany({
      data: [
        { technicianId: johnTech.id, skillName: "Drywall", rating: 5 },
        { technicianId: johnTech.id, skillName: "Carpentry", rating: 4 },
        { technicianId: johnTech.id, skillName: "Fence", rating: 4 },
      ],
    }),
    prisma.technicianSkill.createMany({
      data: [
        { technicianId: mikeTech.id, skillName: "Electrical", rating: 4 },
        { technicianId: mikeTech.id, skillName: "Painting", rating: 4 },
        { technicianId: mikeTech.id, skillName: "Carpentry", rating: 3 },
      ],
    }),
  ]);

  const { customers, properties } = await seedDemoDataForCompany(company.id);
  const priceBookItems = await prisma.priceBookItem.findMany({ where: { companyId: company.id } });
  const findItem = (name: string) => priceBookItems.find((p) => p.name === name)!;

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  async function createEstimate(opts: {
    customerIdx: number;
    title: string;
    priceBookItemName: string;
    laborHours: number;
    materialCost: number;
    sellPrice: number;
    status: "DRAFT" | "SENT" | "FOLLOW_UP_DUE" | "APPROVED" | "DECLINED";
    sentDaysAgo?: number;
    withFollowUpSent?: boolean;
  }) {
    const item = findItem(opts.priceBookItemName);
    const customer = customers[opts.customerIdx];
    const property = properties[opts.customerIdx];

    const number = await nextEstimateNumber(prisma, company.id);
    const laborSell = opts.sellPrice - opts.materialCost;

    const estimate = await prisma.estimate.create({
      data: {
        companyId: company.id,
        number,
        customerId: customer.id,
        propertyId: property.id,
        estimatorId: estimator.id,
        title: opts.title,
        status: opts.status,
        taxPercent: 0,
        depositPercent: opts.status === "APPROVED" ? 30 : null,
        sentAt: opts.sentDaysAgo != null ? daysAgo(opts.sentDaysAgo) : opts.status === "DRAFT" ? null : daysAgo(1),
        respondedAt: opts.status === "APPROVED" || opts.status === "DECLINED" ? daysAgo(Math.max((opts.sentDaysAgo ?? 1) - 1, 0)) : null,
        options: {
          create: {
            tier: "STANDARD",
            label: "Standard",
            isSelected: true,
            sortOrder: 0,
            lineItems: {
              create: [
                {
                  type: "LABOR",
                  description: `${opts.title} — Labor`,
                  quantity: opts.laborHours,
                  unitCost: Number(company.defaultLaborRate),
                  unitPrice: Math.round((laborSell / opts.laborHours) * 100) / 100,
                  sortOrder: 0,
                  priceBookItemId: item.id,
                },
                {
                  type: "MATERIAL",
                  description: `${opts.title} — Materials`,
                  quantity: 1,
                  unitCost: Number(item.materialAllowance ?? 0),
                  unitPrice: opts.materialCost,
                  sortOrder: 1,
                  priceBookItemId: item.id,
                },
              ],
            },
          },
        },
      },
    });

    if (opts.withFollowUpSent) {
      await prisma.estimateFollowUp.create({
        data: {
          estimateId: estimate.id,
          sequenceStep: 1,
          scheduledAt: daysAgo(2),
          sentAt: daysAgo(2),
          channel: "SMS",
          message: "Friendly reminder about your estimate.",
          status: "SENT",
        },
      });
    }

    return estimate;
  }

  // 1. Fence repair — sent, needs follow-up (the MVP success-test scenario)
  const fenceEstimate = await createEstimate({
    customerIdx: 0,
    title: "Fence Repair",
    priceBookItemName: "Fence Panel Repair",
    laborHours: 3,
    materialCost: 190,
    sellPrice: 650,
    status: "FOLLOW_UP_DUE",
    sentDaysAgo: 4,
    withFollowUpSent: true,
  });
  void fenceEstimate;

  // 2. TV mounting — approved and fully carried through to a paid, completed job
  const tvEstimate = await createEstimate({
    customerIdx: 1,
    title: "TV Mounting",
    priceBookItemName: "TV Mounting",
    laborHours: 1.25,
    materialCost: 25,
    sellPrice: 249,
    status: "APPROVED",
    sentDaysAgo: 3,
  });

  // 3. Drywall patch — still a draft
  await createEstimate({
    customerIdx: 2,
    title: "Drywall Patch",
    priceBookItemName: "Drywall Patch (small)",
    laborHours: 2,
    materialCost: 20,
    sellPrice: 225,
    status: "DRAFT",
  });

  // 4. Deck repair — sent a week ago, cold, no response yet
  await createEstimate({
    customerIdx: 3,
    title: "Deck Board Repair",
    priceBookItemName: "Deck Board Repair",
    laborHours: 4,
    materialCost: 260,
    sellPrice: 800,
    status: "SENT",
    sentDaysAgo: 8,
  });

  // 5. Gutter cleaning — declined
  await createEstimate({
    customerIdx: 4,
    title: "Gutter Cleaning",
    priceBookItemName: "Gutter Cleaning",
    laborHours: 1.5,
    materialCost: 0,
    sellPrice: 175,
    status: "DECLINED",
    sentDaysAgo: 5,
  });

  // --- Carry the approved TV mounting estimate all the way to a paid invoice ---
  const jobId = await convertEstimateToJob(tvEstimate.id);
  const scheduledStart = daysAgo(2);
  scheduledStart.setHours(10, 0, 0, 0);
  const scheduledEnd = new Date(scheduledStart.getTime() + 90 * 60 * 1000);

  await prisma.job.update({
    where: { id: jobId },
    data: { scheduledStart, scheduledEnd, status: "COMPLETED", actualStart: scheduledStart, actualEnd: scheduledEnd },
  });
  await prisma.jobAssignment.create({ data: { jobId, userId: techMike.id, role: "TECHNICIAN" } });
  await prisma.timeEntry.create({
    data: {
      companyId: company.id,
      jobId,
      technicianId: techMike.id,
      clockIn: scheduledStart,
      clockOut: new Date(scheduledStart.getTime() + 60 * 60 * 1000),
    },
  });
  await prisma.jobMaterial.create({
    data: { jobId, description: "TV mount bracket", quantity: 1, unitCost: 22, totalCost: 22, source: "ACTUAL" },
  });
  await prisma.jobPhoto.createMany({
    data: [
      { companyId: company.id, jobId, url: "/uploads/placeholder-before.svg", phase: "BEFORE", takenById: techMike.id },
      { companyId: company.id, jobId, url: "/uploads/placeholder-after.svg", phase: "AFTER", takenById: techMike.id },
    ],
  });

  await computeJobCost(jobId);
  const invoiceId = await generateInvoiceForJob(jobId);
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (Number(invoice.balanceDue) > 0) {
    await recordPartialPayment(invoiceId, Number(invoice.balanceDue), {
      method: "CARD",
      provider: "STRIPE_DEV",
      providerReference: "seed-demo-payment",
    });
  }

  // --- A couple more jobs at other stages, without going through an estimate ---
  const scheduledJobNumber = await nextJobNumber(prisma, company.id);
  const upcomingStart = new Date();
  upcomingStart.setDate(upcomingStart.getDate() + 1);
  upcomingStart.setHours(9, 0, 0, 0);
  const scheduledJob = await prisma.job.create({
    data: {
      companyId: company.id,
      number: scheduledJobNumber,
      customerId: customers[3].id,
      propertyId: properties[3].id,
      title: "Deck Board Repair",
      status: "SCHEDULED",
      scheduledStart: upcomingStart,
      scheduledEnd: new Date(upcomingStart.getTime() + 4 * 60 * 60 * 1000),
      quotedTotal: 800,
      quotedLaborCost: 140,
      quotedMaterialCost: 260,
      quotedGrossProfit: 400,
      quotedGrossMarginPercent: 50,
    },
  });
  await prisma.jobAssignment.create({ data: { jobId: scheduledJob.id, userId: techJohn.id, role: "TECHNICIAN" } });

  console.log("\nDemo data ready. Sign in with:");
  console.log("  Owner:      owner@greenwoodhandyman.example / " + DEMO_PASSWORD);
  console.log("  Estimator:  estimator@greenwoodhandyman.example / " + DEMO_PASSWORD);
  console.log("  Office:     office@greenwoodhandyman.example / " + DEMO_PASSWORD);
  console.log("  Technician: john@greenwoodhandyman.example / " + DEMO_PASSWORD);
  console.log("  Technician: mike@greenwoodhandyman.example / " + DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
