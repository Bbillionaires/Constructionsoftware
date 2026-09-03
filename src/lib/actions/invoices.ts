"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, OFFICE_ROLES } from "@/lib/session";
import { recordPartialPayment, encodeReference } from "@/lib/payments-record";
import { getPaymentProvider } from "@/lib/adapters/payments";
import { toCents } from "@/lib/money";
import type { PaymentMethod } from "@prisma/client";

export async function recordManualPaymentAction(invoiceId: string, formData: FormData) {
  const session = await requireSession();
  assertRole(session, OFFICE_ROLES);

  const method = String(formData.get("method") ?? "CASH") as PaymentMethod;
  const amountRaw = String(formData.get("amount") ?? "");

  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: invoiceId, companyId: session.companyId },
  });

  const amount = amountRaw ? parseFloat(amountRaw) : Number(invoice.balanceDue);
  if (amount <= 0) throw new Error("Enter a payment amount.");

  const capped = Math.min(amount, Number(invoice.balanceDue));

  await recordPartialPayment(invoice.id, capped, { method, provider: "MANUAL", providerReference: "manual-entry" });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export async function startInvoiceCheckoutAction(token: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { publicToken: token },
    include: { customer: true, company: true },
  });

  if (Number(invoice.balanceDue) <= 0) redirect(`/invoice-portal/${token}`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const session = await getPaymentProvider().createCheckoutSession({
    amountCents: toCents(invoice.balanceDue),
    description: `Invoice INV-${invoice.number} — ${invoice.company.name}`,
    customerEmail: invoice.customer.email ?? undefined,
    successUrl: `${appUrl}/invoice-portal/${token}/confirm?providerRef={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/invoice-portal/${token}`,
    reference: encodeReference({ kind: "invoice", id: invoice.id }),
  });

  redirect(session.url);
}
