import { prisma } from "@/lib/prisma";
import { nextJobNumber } from "@/lib/numbering";
import { getEstimateTotals, primaryOption } from "@/lib/estimate-totals";
import { fromCents } from "@/lib/money";

/**
 * The single place an approved estimate becomes a job — used by both the
 * "Start Job Now" on-site shortcut and the customer portal approval flow, so
 * there is exactly one code path that ever creates a Job from an Estimate
 * (no duplicate data entry, per the product's core promise).
 */
export async function convertEstimateToJob(estimateId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const estimate = await tx.estimate.findUniqueOrThrow({
      where: { id: estimateId },
      include: { options: { include: { lineItems: true } } },
    });

    const existingJob = await tx.job.findUnique({ where: { estimateId } });
    if (existingJob) return existingJob.id;

    const totals = getEstimateTotals(estimate);
    const option = primaryOption(estimate);
    const number = await nextJobNumber(tx, estimate.companyId);

    const job = await tx.job.create({
      data: {
        companyId: estimate.companyId,
        number,
        customerId: estimate.customerId,
        propertyId: estimate.propertyId,
        estimateId: estimate.id,
        title: estimate.title,
        status: "SCHEDULED",
        quotedTotal: fromCents(totals.totalCents),
        quotedLaborCost: fromCents(totals.laborCostCents),
        quotedMaterialCost: fromCents(totals.materialCostCents),
        quotedOtherCost: fromCents(totals.otherCostCents),
        quotedGrossProfit: fromCents(totals.grossProfitCents),
        quotedGrossMarginPercent: totals.marginPercent,
        services: {
          create: (option?.lineItems ?? [])
            .filter((li) => li.type === "LABOR")
            .map((li) => ({
              priceBookItemId: li.priceBookItemId,
              description: li.description,
              estimatedLaborHours: li.quantity,
            })),
        },
      },
    });

    await tx.estimate.update({
      where: { id: estimate.id },
      data: { status: "APPROVED", respondedAt: estimate.respondedAt ?? new Date() },
    });

    if (estimate.leadId) {
      await tx.lead.update({ where: { id: estimate.leadId }, data: { status: "JOB_SCHEDULED" } });
    }

    return job.id;
  });
}
