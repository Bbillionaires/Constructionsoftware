import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordPaymentSuccess } from "@/lib/payments-record";
import { verifySquareOrderPaid } from "@/lib/adapters/payments";

export default async function InvoiceConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ providerRef?: string; orderId?: string }>;
}) {
  const { token } = await params;
  const { providerRef, orderId } = await searchParams;

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { publicToken: token } });

  if (invoice.status !== "PAID" && orderId) {
    const paid = await verifySquareOrderPaid(orderId);
    if (paid) {
      await recordPaymentSuccess(
        { kind: "invoice", id: invoice.id },
        { method: "CARD", provider: "SQUARE", providerReference: orderId }
      );
    }
  } else if (invoice.status !== "PAID" && providerRef?.startsWith("cs_")) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey) {
      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${providerRef}`, {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      });
      const session = (await res.json()) as { payment_status?: string };
      if (session.payment_status === "paid") {
        await recordPaymentSuccess(
          { kind: "invoice", id: invoice.id },
          { method: "CARD", provider: "STRIPE", providerReference: providerRef }
        );
      }
    }
  }

  redirect(`/invoice-portal/${token}`);
}
