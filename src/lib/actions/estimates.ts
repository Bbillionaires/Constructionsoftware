"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, ESTIMATOR_ROLES } from "@/lib/session";
import { nextEstimateNumber } from "@/lib/numbering";
import { claimFreeEstimateOrRequireSubscription } from "@/lib/billing";
import { scheduleEstimateFollowUps, sendNotificationEmail } from "@/lib/automations";
import { convertEstimateToJob } from "@/lib/estimate-to-job";
import type { EstimateOptionTier, LineItemType } from "@prisma/client";

export async function createEstimateAction(formData: FormData) {
  const session = await requireSession();
  assertRole(session, ESTIMATOR_ROLES);

  const customerId = String(formData.get("customerId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");
  const leadId = String(formData.get("leadId") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "New estimate").trim() || "New estimate";

  if (!customerId || !propertyId) throw new Error("Customer and property are required.");

  const allowed = await claimFreeEstimateOrRequireSubscription(session.companyId);
  if (!allowed) redirect("/billing");

  const estimateId = await prisma.$transaction(async (tx) => {
    const number = await nextEstimateNumber(tx, session.companyId);
    const estimate = await tx.estimate.create({
      data: {
        companyId: session.companyId,
        number,
        customerId,
        propertyId,
        leadId,
        estimatorId: session.userId,
        title,
        taxPercent: 0,
        options: {
          create: {
            tier: "STANDARD",
            label: "Standard",
            isSelected: true,
            sortOrder: 0,
          },
        },
      },
    });
    return estimate.id;
  });

  if (leadId) {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "ESTIMATE_SCHEDULED" } });
  }

  revalidatePath("/estimates");
  redirect(`/estimates/${estimateId}`);
}

export type LineItemPayload = {
  type: LineItemType;
  description: string;
  supplier?: string | null;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  isOptionalUpgrade: boolean;
  priceBookItemId?: string | null;
};

export type OptionPayload = {
  tier: EstimateOptionTier;
  label: string;
  description?: string;
  isSelected: boolean;
  lineItems: LineItemPayload[];
};

export type EstimateSavePayload = {
  title: string;
  taxPercent: number;
  depositPercent: number | null;
  depositAmount: number | null;
  notes: string;
  terms: string;
  options: OptionPayload[];
};

export async function saveEstimateAction(estimateId: string, payload: EstimateSavePayload) {
  const session = await requireSession();
  assertRole(session, ESTIMATOR_ROLES);

  await prisma.$transaction(async (tx) => {
    const estimate = await tx.estimate.findFirstOrThrow({
      where: { id: estimateId, companyId: session.companyId },
    });

    await tx.estimate.update({
      where: { id: estimate.id },
      data: {
        title: payload.title,
        taxPercent: payload.taxPercent,
        depositPercent: payload.depositPercent,
        depositAmount: payload.depositAmount,
        notes: payload.notes,
        terms: payload.terms,
      },
    });

    await tx.estimateOption.deleteMany({ where: { estimateId: estimate.id } });

    for (let i = 0; i < payload.options.length; i++) {
      const opt = payload.options[i];
      await tx.estimateOption.create({
        data: {
          estimateId: estimate.id,
          tier: opt.tier,
          label: opt.label,
          description: opt.description,
          isSelected: opt.isSelected,
          sortOrder: i,
          lineItems: {
            create: opt.lineItems.map((li, j) => ({
              type: li.type,
              description: li.description,
              supplier: li.supplier || null,
              quantity: li.quantity,
              unitCost: li.unitCost,
              unitPrice: li.unitPrice,
              isOptionalUpgrade: li.isOptionalUpgrade,
              priceBookItemId: li.priceBookItemId || null,
              sortOrder: j,
            })),
          },
        },
      });
    }
  });

  revalidatePath(`/estimates/${estimateId}`);
}

export async function sendEstimateAction(estimateId: string) {
  const session = await requireSession();
  assertRole(session, ESTIMATOR_ROLES);

  const estimate = await prisma.estimate.update({
    where: { id: estimateId, companyId: session.companyId },
    data: { status: "SENT", sentAt: new Date(), expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    include: { customer: true, company: true },
  });

  await scheduleEstimateFollowUps(estimate.id);

  if (estimate.leadId) {
    await prisma.lead.update({ where: { id: estimate.leadId }, data: { status: "ESTIMATE_SENT" } });
  }

  if (estimate.customer.email) {
    const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/portal/${estimate.publicToken}`;
    await sendNotificationEmail(
      { companyId: estimate.companyId, customerId: estimate.customerId },
      estimate.customer.email,
      `Your estimate from ${estimate.company.name}`,
      `<p>Hi ${estimate.customer.firstName},</p>
       <p>Your estimate "${estimate.title}" from ${estimate.company.name} is ready to review.</p>
       <p><a href="${link}">View and approve your estimate</a></p>`
    );
  }

  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/estimates/recovery");
  return estimate.publicToken;
}

export async function startJobNowAction(estimateId: string) {
  const session = await requireSession();
  assertRole(session, ESTIMATOR_ROLES);

  const estimate = await prisma.estimate.findFirstOrThrow({
    where: { id: estimateId, companyId: session.companyId },
  });

  const jobId = await convertEstimateToJob(estimate.id);
  revalidatePath("/jobs");
  revalidatePath(`/estimates/${estimateId}`);
  redirect(`/jobs/${jobId}`);
}
