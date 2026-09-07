import "server-only";
import { prisma } from "@/lib/prisma";
import { getEstimateTotals, OPEN_ESTIMATE_STATUSES, decToNum } from "@/lib/estimate-totals";
import { fromCents } from "@/lib/money";
import { SALES_RANGE_PRESETS, type SalesRangePreset } from "@/lib/dashboard-ranges";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}
function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type SalesRange = { start: Date; end: Date; preset: SalesRangePreset; label: string };

/** Resolves the dashboard's sales-metrics window from URL search params (preset, or custom from/to). */
export function resolveSalesRange(preset?: string | null, from?: string | null, to?: string | null): SalesRange {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);

  if (preset === "custom" && from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      const start = startOfDay(fromDate);
      const end = addDays(startOfDay(toDate), 1);
      if (start < end) {
        return { start, end, preset: "custom", label: `${formatDate(start)} – ${formatDate(startOfDay(toDate))}` };
      }
    }
  }

  const known = SALES_RANGE_PRESETS.find((p) => p.value === preset);
  switch (known?.value) {
    case "7d":
      return { start: addDays(todayStart, -7), end: todayEnd, preset: "7d", label: known.label };
    case "30d":
      return { start: addDays(todayStart, -30), end: todayEnd, preset: "30d", label: known.label };
    case "3m":
      return { start: startOfDay(addMonths(now, -3)), end: todayEnd, preset: "3m", label: known.label };
    case "6m":
      return { start: startOfDay(addMonths(now, -6)), end: todayEnd, preset: "6m", label: known.label };
    case "1y":
      return { start: startOfDay(addMonths(now, -12)), end: todayEnd, preset: "1y", label: known.label };
    default:
      return { start: todayStart, end: todayEnd, preset: "today", label: "Today" };
  }
}

export async function getDashboardData(companyId: string, salesRange: SalesRange) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);

  const [
    paymentsInRange,
    outstandingInvoices,
    openEstimates,
    jobsToday,
    jobsThisWeek,
    newLeadsCount,
    leadsAwaitingResponse,
    estimatesAwaitingFollowUp,
    jobsCompletedInRange,
    estimatesRespondedInRange,
    technicianCount,
    company,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { companyId, status: "SUCCEEDED", paidAt: { gte: salesRange.start, lt: salesRange.end } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { companyId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      _sum: { balanceDue: true },
    }),
    prisma.estimate.findMany({
      where: { companyId, status: { in: [...OPEN_ESTIMATE_STATUSES] } },
      include: { options: { include: { lineItems: true } } },
    }),
    prisma.job.count({ where: { companyId, scheduledStart: { gte: todayStart, lt: todayEnd } } }),
    prisma.job.count({ where: { companyId, scheduledStart: { gte: weekStart, lt: weekEnd } } }),
    prisma.lead.count({ where: { companyId, receivedAt: { gte: addDays(now, -7) } } }),
    prisma.lead.count({ where: { companyId, status: "NEW" } }),
    prisma.estimate.count({ where: { companyId, status: "FOLLOW_UP_DUE" } }),
    prisma.job.findMany({
      where: {
        companyId,
        status: { in: ["COMPLETED", "INVOICED", "CLOSED"] },
        actualEnd: { gte: salesRange.start, lt: salesRange.end },
      },
      include: { jobCost: true },
    }),
    prisma.estimate.count({
      where: { companyId, respondedAt: { gte: salesRange.start, lt: salesRange.end }, status: { in: ["APPROVED", "DECLINED"] } },
    }),
    prisma.technician.count({ where: { companyId, isActive: true } }),
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
  ]);

  const approvedInRange = await prisma.estimate.count({
    where: { companyId, status: "APPROVED", respondedAt: { gte: salesRange.start, lt: salesRange.end } },
  });

  const openEstimateValue = openEstimates.reduce(
    (sum, e) => sum + fromCents(getEstimateTotals(e).totalCents),
    0
  );
  const needsFollowUpValue = openEstimates
    .filter((e) => e.status === "FOLLOW_UP_DUE")
    .reduce((sum, e) => sum + fromCents(getEstimateTotals(e).totalCents), 0);
  const noResponse3Value = openEstimates
    .filter((e) => {
      const ref = e.sentAt ?? e.createdAt;
      return (now.getTime() - ref.getTime()) / 86400000 >= 3;
    })
    .reduce((sum, e) => sum + fromCents(getEstimateTotals(e).totalCents), 0);
  const noResponse7Value = openEstimates
    .filter((e) => {
      const ref = e.sentAt ?? e.createdAt;
      return (now.getTime() - ref.getTime()) / 86400000 >= 7;
    })
    .reduce((sum, e) => sum + fromCents(getEstimateTotals(e).totalCents), 0);

  const recoveredInRange = await prisma.estimate.findMany({
    where: { companyId, status: "APPROVED", respondedAt: { gte: salesRange.start, lt: salesRange.end } },
    include: { options: { include: { lineItems: true } }, followUps: true },
  });
  const recoveredValue = recoveredInRange
    .filter((e) => e.followUps.some((f) => f.status === "SENT"))
    .reduce((sum, e) => sum + fromCents(getEstimateTotals(e).totalCents), 0);

  const grossProfitInRange = jobsCompletedInRange.reduce(
    (sum, j) => sum + (j.jobCost ? decToNum(j.jobCost.actualGrossProfit) : decToNum(j.quotedGrossProfit)),
    0
  );
  const revenueInRange = jobsCompletedInRange.reduce((sum, j) => sum + decToNum(j.quotedTotal), 0);
  const averageTicket = jobsCompletedInRange.length > 0 ? revenueInRange / jobsCompletedInRange.length : 0;

  const scheduledHoursThisWeek = await prisma.job.findMany({
    where: { companyId, scheduledStart: { gte: weekStart, lt: weekEnd }, scheduledEnd: { not: null } },
    select: { scheduledStart: true, scheduledEnd: true },
  });
  const bookedHours = scheduledHoursThisWeek.reduce(
    (sum, j) => sum + (j.scheduledEnd!.getTime() - j.scheduledStart!.getTime()) / 3600000,
    0
  );
  const capacityHours = technicianCount * 8 * 5;
  const crewUtilization = capacityHours > 0 ? (bookedHours / capacityHours) * 100 : 0;

  const jobsMissingAfterPhotos = await prisma.job.count({
    where: {
      companyId,
      status: { in: ["COMPLETED", "INVOICED"] },
      photos: { none: { phase: "AFTER" } },
    },
  });
  const overdueInvoicesCount = await prisma.invoice.count({
    where: { companyId, balanceDue: { gt: 0 }, dueDate: { lt: now } },
  });

  return {
    salesRangeLabel: salesRange.label,
    cashCollected: decToNum(paymentsInRange._sum.amount),
    revenueBooked: revenueInRange,
    grossProfit: grossProfitInRange,
    jobsCompletedCount: jobsCompletedInRange.length,
    averageTicket,
    conversionRate: estimatesRespondedInRange > 0 ? (approvedInRange / estimatesRespondedInRange) * 100 : 0,
    outstandingInvoices: decToNum(outstandingInvoices._sum.balanceDue),
    openEstimateCount: openEstimates.length,
    openEstimateValue,
    jobsToday,
    jobsThisWeek,
    newLeadsCount,
    leadsAwaitingResponse,
    estimatesAwaitingFollowUp,
    crewUtilization,
    needsFollowUpValue,
    noResponse3Value,
    noResponse7Value,
    recoveredValue,
    jobsMissingAfterPhotos,
    overdueInvoicesCount,
    targetMarginPercent: decToNum(company.targetMarginPercent),
  };
}
