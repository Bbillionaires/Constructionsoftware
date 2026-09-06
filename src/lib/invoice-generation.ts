import { prisma } from "@/lib/prisma";
import { nextInvoiceNumber } from "@/lib/numbering";
import { decToNum, primaryOption } from "@/lib/estimate-totals";

/**
 * Generates an invoice from a completed job's estimate — the agreed selling
 * price flows straight through with no re-entry. Any deposit already
 * collected on the estimate is credited against the invoice immediately.
 */
export async function generateInvoiceForJob(jobId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({ where: { jobId } });
    if (existing) return existing.id;

    const job = await tx.job.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        estimate: {
          include: { options: { include: { lineItems: true } }, deposits: { where: { status: "PAID" } } },
        },
        changeOrders: { where: { status: "APPROVED" } },
      },
    });

    const number = await nextInvoiceNumber(tx, job.companyId);

    let lineItems: { description: string; quantity: number; unitPrice: number }[] = [];
    let taxPercent = 0;
    let depositCreditedDollars = 0;

    if (job.estimate) {
      const option = primaryOption(job.estimate);
      lineItems = (option?.lineItems ?? [])
        .filter((li) => !li.isOptionalUpgrade)
        .map((li) => ({
          description: li.description,
          quantity: decToNum(li.quantity),
          unitPrice: decToNum(li.unitPrice),
        }));
      taxPercent = decToNum(job.estimate.taxPercent);
      depositCreditedDollars = job.estimate.deposits.reduce((sum, d) => sum + decToNum(d.amount), 0);
    } else {
      lineItems = [{ description: job.title, quantity: 1, unitPrice: decToNum(job.quotedTotal) }];
    }

    for (const co of job.changeOrders) {
      lineItems.push({
        description: `Change order: ${co.description}`,
        quantity: 1,
        unitPrice: decToNum(co.totalAmount),
      });
    }

    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
    const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
    const totalAmount = subtotal + taxAmount;
    const amountPaid = Math.min(depositCreditedDollars, totalAmount);
    const balanceDue = Math.max(totalAmount - amountPaid, 0);

    const invoice = await tx.invoice.create({
      data: {
        companyId: job.companyId,
        number,
        jobId: job.id,
        customerId: job.customerId,
        status: balanceDue <= 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "SENT",
        subtotal,
        taxPercent,
        taxAmount,
        totalAmount,
        amountPaid,
        balanceDue,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        issuedAt: new Date(),
        lineItems: {
          create: lineItems.map((li, i) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            amount: Math.round(li.quantity * li.unitPrice * 100) / 100,
            sortOrder: i,
          })),
        },
      },
    });

    if (depositCreditedDollars > 0) {
      await tx.payment.create({
        data: {
          companyId: job.companyId,
          invoiceId: invoice.id,
          amount: amountPaid,
          method: "CARD",
          provider: "STRIPE_DEV",
          providerReference: "deposit-credit",
          status: "SUCCEEDED",
        },
      });
    }

    await tx.job.update({ where: { id: job.id }, data: { status: "INVOICED" } });

    return invoice.id;
  });
}
