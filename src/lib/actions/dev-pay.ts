"use server";

import { redirect } from "next/navigation";
import { decodeReference, recordPaymentSuccess } from "@/lib/payments-record";

/**
 * Confirms a simulated card payment on the /pay/dev page. Only reachable
 * when no Stripe key is configured (see getPaymentProvider). Ignores any
 * client-supplied amount — the paid amount always comes from the
 * authoritative Deposit/Invoice row via recordPaymentSuccess.
 */
export async function confirmDevPaymentAction(formData: FormData) {
  const reference = String(formData.get("reference") ?? "");
  const providerRef = String(formData.get("ref") ?? "");
  const successUrl = String(formData.get("successUrl") ?? "/");

  await recordPaymentSuccess(decodeReference(reference), {
    method: "CARD",
    provider: "STRIPE_DEV",
    providerReference: providerRef,
  });

  redirect(successUrl);
}
