import { prisma } from "@/lib/prisma";
import { scheduleReviewRequest } from "@/lib/automations";
import type { PaymentMethod, PaymentProvider as PaymentProviderEnum } from "@prisma/client";

export type PaymentReference = { kind: "deposit"; id: string } | { kind: "invoice"; id: string };

export function encodeReference(ref: PaymentReference) {
  return `${ref.kind}:${ref.id}`;
}

export function decodeReference(raw: string): PaymentReference {
  const [kind, id] = raw.split(":");
  if (kind !== "deposit" && kind !== "invoice") throw new Error("Invalid payment reference.");
  return { kind, id };
}

async function applyInvoicePayment(
  invoiceId: string,
  amount: number,
  opts: { method: PaymentMethod; provider: PaymentProviderEnum; providerReference: string }
) {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (invoice.status === "PAID" || amount <= 0) return { invoiceId: invoice.id };

  await prisma.payment.create({
    data: {
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      amount,
      method: opts.method,
      provider: opts.provider,
      providerReference: opts.providerReference,
      status: "SUCCEEDED",
    },
  });

  const newAmountPaid = Number(invoice.amountPaid) + amount;
  const newBalance = Math.max(Number(invoice.totalAmount) - newAmountPaid, 0);
  const paidOff = newBalance <= 0;
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: newAmountPaid,
      balanceDue: newBalance,
      status: paidOff ? "PAID" : "PARTIAL",
    },
  });

  if (paidOff) {
    await scheduleReviewRequest(invoice.jobId, invoice.companyId);
  }

  return { invoiceId: invoice.id };
}

/**
 * Records a successful charge for a deposit or a full-balance invoice
 * checkout. The authoritative amount always comes from the database row
 * itself (Deposit.amount, or the invoice's current balance) — never from
 * client-supplied form data — so a tampered query string can't under- or
 * over-charge. For a manually-entered partial payment, use
 * recordPartialPayment instead.
 */
export async function recordPaymentSuccess(
  ref: PaymentReference,
  opts: { method: PaymentMethod; provider: PaymentProviderEnum; providerReference: string }
) {
  if (ref.kind === "deposit") {
    const deposit = await prisma.deposit.findUniqueOrThrow({ where: { id: ref.id } });
    if (deposit.status === "PAID") return { estimateId: deposit.estimateId };

    const payment = await prisma.payment.create({
      data: {
        companyId: deposit.companyId,
        amount: deposit.amount,
        method: opts.method,
        provider: opts.provider,
        providerReference: opts.providerReference,
        status: "SUCCEEDED",
      },
    });
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { status: "PAID", collectedAt: new Date(), paymentId: payment.id },
    });
    return { estimateId: deposit.estimateId };
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: ref.id } });
  return applyInvoicePayment(invoice.id, Number(invoice.balanceDue), opts);
}

/** Office-entered payment (cash/check/manual card) for an arbitrary amount up to the balance due. */
export async function recordPartialPayment(
  invoiceId: string,
  amount: number,
  opts: { method: PaymentMethod; provider: PaymentProviderEnum; providerReference: string }
) {
  return applyInvoicePayment(invoiceId, amount, opts);
}
