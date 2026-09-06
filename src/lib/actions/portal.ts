"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getEstimateTotals } from "@/lib/estimate-totals";
import { getPaymentProvider } from "@/lib/adapters/payments";
import { encodeReference } from "@/lib/payments-record";
import { convertEstimateToJob } from "@/lib/estimate-to-job";
import { fromCents } from "@/lib/money";

async function getEstimateByToken(token: string) {
  return prisma.estimate.findUniqueOrThrow({
    where: { publicToken: token },
    include: {
      options: { include: { lineItems: true } },
      customer: true,
      job: { select: { id: true } },
    },
  });
}

export async function markEstimateViewedAction(token: string) {
  await prisma.estimate.updateMany({
    where: { publicToken: token, status: "SENT" },
    data: { status: "VIEWED", viewedAt: new Date() },
  });
}

export async function approveEstimateAction(
  token: string,
  payload: { optionId: string; acceptedUpgradeLineItemIds: string[]; signerName: string; signatureDataUrl: string }
) {
  const estimate = await getEstimateByToken(token);
  if (estimate.job) redirect(`/portal/${token}/thank-you`);
  if (estimate.status === "APPROVED") redirect(`/portal/${token}/deposit`);

  const chosenOption = estimate.options.find((o) => o.id === payload.optionId);
  if (!chosenOption) throw new Error("That option is no longer available.");

  await prisma.$transaction(async (tx) => {
    await tx.estimateOption.updateMany({ where: { estimateId: estimate.id }, data: { isSelected: false } });
    await tx.estimateOption.update({ where: { id: chosenOption.id }, data: { isSelected: true } });

    for (const li of chosenOption.lineItems) {
      if (!li.isOptionalUpgrade) continue;
      if (payload.acceptedUpgradeLineItemIds.includes(li.id)) {
        await tx.estimateLineItem.update({ where: { id: li.id }, data: { isOptionalUpgrade: false } });
      } else {
        await tx.estimateLineItem.delete({ where: { id: li.id } });
      }
    }

    await tx.signature.create({
      data: {
        companyId: estimate.companyId,
        estimateId: estimate.id,
        signerName: payload.signerName,
        imageDataUrl: payload.signatureDataUrl,
      },
    });

    await tx.estimate.update({
      where: { id: estimate.id },
      data: { status: "APPROVED", respondedAt: new Date() },
    });

    if (estimate.leadId) {
      await tx.lead.update({ where: { id: estimate.leadId }, data: { status: "APPROVED" } });
    }
  });

  revalidatePath(`/estimates/${estimate.id}`);
  revalidatePath("/estimates/recovery");
  redirect(`/portal/${token}/deposit`);
}

export async function declineEstimateAction(token: string, reason: string) {
  const estimate = await getEstimateByToken(token);
  // A stale/back-button view of the portal page could still submit this
  // after the customer already approved (and possibly converted to a job)
  // elsewhere — never let a decline undo that.
  if (estimate.job || estimate.status === "APPROVED") redirect(`/portal/${token}`);
  await prisma.estimate.update({
    where: { id: estimate.id },
    data: { status: "DECLINED", declinedReason: reason || null, respondedAt: new Date() },
  });
  if (estimate.leadId) {
    await prisma.lead.update({ where: { id: estimate.leadId }, data: { status: "LOST", lostReason: reason } });
  }
  revalidatePath(`/estimates/${estimate.id}`);
  revalidatePath("/estimates/recovery");
}

export async function startDepositCheckoutAction(token: string) {
  const estimate = await getEstimateByToken(token);
  const totals = getEstimateTotals(estimate);

  if (totals.depositCents <= 0) {
    const jobId = await convertEstimateToJob(estimate.id);
    redirect(`/portal/${token}/thank-you?jobId=${jobId}`);
  }

  const deposit = await prisma.deposit.create({
    data: {
      companyId: estimate.companyId,
      estimateId: estimate.id,
      amount: fromCents(totals.depositCents),
      method: "CARD",
      status: "PENDING",
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const session = await getPaymentProvider().createCheckoutSession({
    amountCents: totals.depositCents,
    description: `Deposit — ${estimate.title}`,
    customerEmail: estimate.customer.email ?? undefined,
    successUrl: `${appUrl}/portal/${token}/deposit-confirm?depositId=${deposit.id}&providerRef={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/portal/${token}/deposit`,
    reference: encodeReference({ kind: "deposit", id: deposit.id }),
  });

  redirect(session.url);
}
