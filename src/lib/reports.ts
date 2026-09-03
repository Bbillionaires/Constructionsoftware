import "server-only";
import { prisma } from "@/lib/prisma";
import { decToNum } from "@/lib/estimate-totals";

const REALIZED_JOB_STATUSES = ["COMPLETED", "INVOICED", "CLOSED"] as const;

export async function getRevenueByMonth(companyId: string, months = 6) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const payments = await prisma.payment.findMany({
    where: { companyId, status: "SUCCEEDED", paidAt: { gte: start } },
    select: { amount: true, paidAt: true },
  });

  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }), year: d.getFullYear(), month: d.getMonth(), total: 0 };
  });

  for (const p of payments) {
    const bucket = buckets.find((b) => b.year === p.paidAt.getFullYear() && b.month === p.paidAt.getMonth());
    if (bucket) bucket.total += decToNum(p.amount);
  }

  return buckets;
}

export async function getLeadSourceReport(companyId: string) {
  const leads = await prisma.lead.findMany({
    where: { companyId },
    select: { source: true, status: true, estimatedValue: true },
  });

  const bySource = new Map<string, { total: number; won: number; value: number }>();
  for (const lead of leads) {
    const entry = bySource.get(lead.source) ?? { total: 0, won: 0, value: 0 };
    entry.total++;
    if (lead.status === "COMPLETED" || lead.status === "JOB_SCHEDULED" || lead.status === "APPROVED") entry.won++;
    entry.value += decToNum(lead.estimatedValue);
    bySource.set(lead.source, entry);
  }

  return [...bySource.entries()]
    .map(([source, v]) => ({
      source,
      total: v.total,
      won: v.won,
      conversionRate: v.total > 0 ? (v.won / v.total) * 100 : 0,
      value: v.value,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getServiceProfitabilityReport(companyId: string) {
  const [jobs, priceBookItems] = await Promise.all([
    prisma.job.findMany({
      where: { companyId, status: { in: [...REALIZED_JOB_STATUSES] }, estimateId: { not: null } },
      include: {
        estimate: { include: { options: { include: { lineItems: true } } } },
      },
    }),
    prisma.priceBookItem.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);
  const priceBookNames = new Map(priceBookItems.map((p) => [p.id, p.name]));

  const bySku = new Map<string, { name: string; jobs: Set<string>; revenue: number; cost: number }>();

  for (const job of jobs) {
    if (!job.estimate) continue;
    const option = job.estimate.options.find((o) => o.isSelected) ?? job.estimate.options[0];
    if (!option) continue;
    for (const li of option.lineItems) {
      const key = li.priceBookItemId ?? `custom:${li.description}`;
      const name = (li.priceBookItemId && priceBookNames.get(li.priceBookItemId)) || li.description;
      const entry = bySku.get(key) ?? { name, jobs: new Set(), revenue: 0, cost: 0 };
      entry.revenue += decToNum(li.quantity) * decToNum(li.unitPrice);
      entry.cost += decToNum(li.quantity) * decToNum(li.unitCost);
      entry.jobs.add(job.id);
      bySku.set(key, entry);
    }
  }

  return [...bySku.entries()]
    .map(([key, v]) => ({
      key,
      name: v.name,
      jobCount: v.jobs.size,
      revenue: v.revenue,
      grossProfit: v.revenue - v.cost,
      marginPercent: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getTechnicianProductivityReport(companyId: string) {
  const technicians = await prisma.technician.findMany({
    where: { companyId },
    include: { user: true },
  });

  const results = [];
  for (const tech of technicians) {
    const [jobsCompleted, timeEntries, assignedJobs] = await Promise.all([
      prisma.job.count({
        where: {
          companyId,
          status: { in: [...REALIZED_JOB_STATUSES] },
          assignments: { some: { userId: tech.userId } },
        },
      }),
      prisma.timeEntry.findMany({ where: { companyId, technicianId: tech.userId, clockOut: { not: null } } }),
      prisma.job.findMany({
        where: { companyId, status: { in: [...REALIZED_JOB_STATUSES] }, assignments: { some: { userId: tech.userId } } },
        select: { quotedTotal: true },
      }),
    ]);

    const hours = timeEntries.reduce(
      (sum, t) => sum + (t.clockOut!.getTime() - t.clockIn.getTime()) / 3600000,
      0
    );
    const revenue = assignedJobs.reduce((sum, j) => sum + decToNum(j.quotedTotal), 0);

    results.push({
      name: tech.user.name,
      jobsCompleted,
      hours,
      revenue,
      revenuePerHour: hours > 0 ? revenue / hours : 0,
    });
  }

  return results.sort((a, b) => b.revenue - a.revenue);
}

export async function getVarianceReport(companyId: string) {
  const costs = await prisma.jobCost.findMany({
    where: { job: { companyId } },
  });

  const laborHoursEstimated = costs.reduce((sum, c) => sum + decToNum(c.laborHoursEstimated), 0);
  const laborHoursActual = costs.reduce((sum, c) => sum + decToNum(c.laborHoursActual), 0);
  const materialCostEstimated = costs.reduce((sum, c) => sum + decToNum(c.materialCostEstimated), 0);
  const materialCostActual = costs.reduce((sum, c) => sum + decToNum(c.actualMaterialCost), 0);
  const quotedMargin =
    costs.length > 0
      ? costs.reduce((sum, c) => sum + decToNum(c.actualGrossMarginPercent), 0) / costs.length
      : 0;

  return {
    jobCount: costs.length,
    laborHoursEstimated,
    laborHoursActual,
    laborHoursVariance: laborHoursActual - laborHoursEstimated,
    materialCostEstimated,
    materialCostActual,
    materialCostVariance: materialCostActual - materialCostEstimated,
    averageActualMargin: quotedMargin,
  };
}
