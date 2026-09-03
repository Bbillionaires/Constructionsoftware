import { prisma } from "@/lib/prisma";
import { decToNum } from "@/lib/estimate-totals";

/** Recomputes actual-vs-quoted profitability for a job from its time entries and materials. */
export async function computeJobCost(jobId: string) {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      timeEntries: { include: { technician: { include: { technicianProfile: true } } } },
      jobMaterials: true,
      services: true,
      company: true,
    },
  });

  let laborHoursActual = 0;
  let actualLaborCost = 0;
  for (const entry of job.timeEntries) {
    if (!entry.clockOut) continue;
    const hours = Math.max((entry.clockOut.getTime() - entry.clockIn.getTime()) / 3600000 - entry.breakMinutes / 60, 0);
    const rate = entry.technician.technicianProfile?.hourlyCostRate
      ? decToNum(entry.technician.technicianProfile.hourlyCostRate)
      : decToNum(job.company.defaultLaborRate);
    laborHoursActual += hours;
    actualLaborCost += hours * rate;
  }

  const actualMaterialCost = job.jobMaterials
    .filter((m) => m.source === "ACTUAL")
    .reduce((sum, m) => sum + decToNum(m.totalCost), 0);

  const laborHoursEstimated = job.services.reduce((sum, s) => sum + decToNum(s.estimatedLaborHours), 0);
  const materialCostEstimated = decToNum(job.quotedMaterialCost);

  const actualOtherCost = 0;
  const actualRevenue = decToNum(job.quotedTotal);
  const actualGrossProfit = actualRevenue - actualLaborCost - actualMaterialCost - actualOtherCost;
  const actualGrossMarginPercent = actualRevenue > 0 ? (actualGrossProfit / actualRevenue) * 100 : 0;

  await prisma.jobCost.upsert({
    where: { jobId: job.id },
    create: {
      jobId: job.id,
      actualLaborCost,
      actualMaterialCost,
      actualOtherCost,
      actualRevenue,
      actualGrossProfit,
      actualGrossMarginPercent,
      laborHoursEstimated,
      laborHoursActual,
      materialCostEstimated,
    },
    update: {
      actualLaborCost,
      actualMaterialCost,
      actualOtherCost,
      actualRevenue,
      actualGrossProfit,
      actualGrossMarginPercent,
      laborHoursEstimated,
      laborHoursActual,
      materialCostEstimated,
      computedAt: new Date(),
    },
  });
}
