import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Atomically reserves and returns the next human-facing sequence number for a company. */
async function nextNumber(tx: Tx, companyId: string, field: "nextEstimateNumber" | "nextJobNumber" | "nextInvoiceNumber") {
  const company = await tx.company.update({
    where: { id: companyId },
    data: { [field]: { increment: 1 } },
    select: { [field]: true },
  });
  return (company as unknown as Record<string, number>)[field] - 1;
}

export const nextEstimateNumber = (tx: Tx, companyId: string) => nextNumber(tx, companyId, "nextEstimateNumber");
export const nextJobNumber = (tx: Tx, companyId: string) => nextNumber(tx, companyId, "nextJobNumber");
export const nextInvoiceNumber = (tx: Tx, companyId: string) => nextNumber(tx, companyId, "nextInvoiceNumber");
