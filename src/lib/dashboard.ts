import "server-only";
import { prisma } from "@/lib/prisma";
import { getEstimateTotals, OPEN_ESTIMATE_STATUSES, decToNum } from "@/lib/estimate-totals";
import { fromCents } from "@/lib/money";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

export async function getDashboardData(companyId: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = startOfMonth(now);
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    paymentsToday,
    paymentsMonth,
    outstandingInvoices,
    openEstimates,
    jobsToday,
    jobsThisWeek,
    newLeadsCount,
    leadsAwaitingResponse,
    estimatesAwaitingFollowUp,
    jobsCompletedMonth,
    estimatesRespondedMonth,
    technicianCount,
    company,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { companyId, status: "SUCCEEDED", paidAt: { gte: todayStart, lt: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { companyId, status: "SUCCEEDED", paidAt: { gte: monthStart } },
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
    prisma.lead.count({ where: { companyId, receivedAt: { gte: new Date(now.getTime() - 7 * 86400000) } } }),
    prisma.lead.count({ where: { companyId, status: "NEW" } }),
    prisma.estimate.count({ where: { companyId, status: "FOLLOW_UP_DUE" } }),
    prisma.job.findMany({
      where: { companyId, status: { in: ["COMPLETED", "INVOICED", "CLOSED"] }, actualEnd: { gte: monthStart } },
      include: { jobCost: true },
    }),
    prisma.estimate.count({
      where: { companyId, respondedAt: { gte: monthStart }, status: { in: ["APPROVED", "DECLINED"] } },
    }),
    prisma.technician.count({ where: { companyId, isActive: true } }),
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
  ]);

  const approvedThisMonth = await prisma.estimate.count({
    where: { companyId, status: "APPROVED", respondedAt: { gte: monthStart } },
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

  const recoveredMonth = await prisma.estimate.findMany({
    where: { companyId, status: "APPROVED", respondedAt: { gte: monthStart } },
    include: { options: { include: { lineItems: true } }, followUps: true },
  });
  const recoveredValue = recoveredMonth
    .filter((e) => e.followUps.some((f) => f.status === "SENT"))
    .reduce((sum, e) => sum + fromCents(getEstimateTotals(e).totalCents), 0);

  const grossProfitMonth = jobsCompletedMonth.reduce(
    (sum, j) => sum + (j.jobCost ? decToNum(j.jobCost.actualGrossProfit) : decToNum(j.quotedGrossProfit)),
    0
  );
  const revenueMonth = jobsCompletedMonth.reduce((sum, j) => sum + decToNum(j.quotedTotal), 0);
  const averageTicket = jobsCompletedMonth.length > 0 ? revenueMonth / jobsCompletedMonth.length : 0;

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
    todaysRevenue: decToNum(paymentsToday._sum.amount),
    cashCollectedMonth: decToNum(paymentsMonth._sum.amount),
    revenueMonth,
    outstandingInvoices: decToNum(outstandingInvoices._sum.balanceDue),
    openEstimateCount: openEstimates.length,
    openEstimateValue,
    jobsToday,
    jobsThisWeek,
    newLeadsCount,
    leadsAwaitingResponse,
    estimatesAwaitingFollowUp,
    conversionRate: estimatesRespondedMonth > 0 ? (approvedThisMonth / estimatesRespondedMonth) * 100 : 0,
    averageTicket,
    jobsCompletedMonth: jobsCompletedMonth.length,
    grossProfitMonth,
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
