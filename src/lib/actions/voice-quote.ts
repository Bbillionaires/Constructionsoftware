"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, ESTIMATOR_ROLES } from "@/lib/session";
import { nextEstimateNumber } from "@/lib/numbering";
import { claimFreeEstimateOrRequireSubscription } from "@/lib/billing";
import { getVoiceQuoteProvider } from "@/lib/adapters/voice-quote";

export async function createEstimateFromVoiceAction(formData: FormData) {
  const session = await requireSession();
  assertRole(session, ESTIMATOR_ROLES);

  const customerId = String(formData.get("customerId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");
  const leadId = String(formData.get("leadId") ?? "").trim() || null;
  const audio = formData.get("audio");

  if (!customerId || !propertyId) throw new Error("Customer and property are required.");
  if (!(audio instanceof File) || audio.size === 0) throw new Error("No recording was captured.");

  const allowed = await claimFreeEstimateOrRequireSubscription(session.companyId);
  if (!allowed) redirect("/billing");

  const buffer = Buffer.from(await audio.arrayBuffer());
  const result = await getVoiceQuoteProvider().process(buffer, audio.type);

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
        title: result.title,
        taxPercent: 0,
        voiceTranscript: result.transcript,
        options: {
          create: {
            tier: "STANDARD",
            label: "Standard",
            isSelected: true,
            sortOrder: 0,
            lineItems: {
              create: result.lineItems.map((li, i) => ({
                type: li.type,
                description: li.description,
                supplier: li.supplier,
                quantity: li.quantity,
                unitCost: li.unitCost,
                unitPrice: li.unitPrice,
                sortOrder: i,
              })),
            },
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
