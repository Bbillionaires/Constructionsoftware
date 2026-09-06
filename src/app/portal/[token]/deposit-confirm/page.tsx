import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordPaymentSuccess } from "@/lib/payments-record";
import { convertEstimateToJob } from "@/lib/estimate-to-job";
import { verifySquareOrderPaid } from "@/lib/adapters/payments";

/**
 * Landing point after a real Stripe or Square checkout succeeds (the
 * dev-simulated flow marks the deposit paid itself before redirecting here).
 * Verifies the payment directly against the provider's API before trusting
 * it — no webhook required for this simple "pay a fixed deposit" flow.
 */
export default async function DepositConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ depositId?: string; providerRef?: string; orderId?: string }>;
}) {
  const { token } = await params;
  const { depositId, providerRef, orderId } = await searchParams;

  if (!depositId) redirect(`/portal/${token}`);

  const deposit = await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } });

  if (deposit.status !== "PAID") {
    if (orderId) {
      const paid = await verifySquareOrderPaid(orderId);
      if (!paid) redirect(`/portal/${token}/deposit`);
      await recordPaymentSuccess(
        { kind: "deposit", id: deposit.id },
        { method: "CARD", provider: "SQUARE", providerReference: orderId }
      );
    } else {
      if (!providerRef?.startsWith("cs_")) {
        redirect(`/portal/${token}/deposit`);
      }
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) redirect(`/portal/${token}/deposit`);

      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${providerRef}`, {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      });
      const session = (await res.json()) as { payment_status?: string };
      if (session.payment_status !== "paid") {
        redirect(`/portal/${token}/deposit`);
      }

      await recordPaymentSuccess(
        { kind: "deposit", id: deposit.id },
        { method: "CARD", provider: "STRIPE", providerReference: providerRef }
      );
    }
  }

  const jobId = await convertEstimateToJob(deposit.estimateId);
  redirect(`/portal/${token}/thank-you?jobId=${jobId}`);
}
