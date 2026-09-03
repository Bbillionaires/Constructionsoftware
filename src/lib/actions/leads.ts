"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, OFFICE_ROLES } from "@/lib/session";
import { runActiveAutomations } from "@/lib/automations";
import type { LeadSource, LeadStatus } from "@prisma/client";

export async function createLeadAction(formData: FormData) {
  const session = await requireSession();
  assertRole(session, OFFICE_ROLES);

  const existingCustomerId = String(formData.get("existingCustomerId") ?? "").trim() || null;
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const source = String(formData.get("source") ?? "OTHER") as LeadSource;
  const requestedService = String(formData.get("requestedService") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const estimatedValueRaw = String(formData.get("estimatedValue") ?? "").trim();
  const assignedToId = String(formData.get("assignedToId") ?? "").trim() || null;
  const wasMissedCall = formData.get("wasMissedCall") === "on";

  if (!requestedService) throw new Error("Requested service is required.");
  if (!existingCustomerId && (!firstName || !lastName)) {
    throw new Error("Customer name is required.");
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });

  const { leadId, customerId: finalCustomerId } = await prisma.$transaction(async (tx) => {
    let customerId = existingCustomerId;
    if (!customerId) {
      const customer = await tx.customer.create({
        data: { companyId: session.companyId, firstName, lastName, phone, email },
      });
      customerId = customer.id;
    }

    let propertyId: string | null = null;
    if (addressLine1 && city && state && postalCode) {
      const property = await tx.property.create({
        data: { companyId: session.companyId, customerId, addressLine1, city, state, postalCode },
      });
      propertyId = property.id;
    }

    const lead = await tx.lead.create({
      data: {
        companyId: session.companyId,
        customerId,
        propertyId,
        source,
        requestedService,
        description,
        assignedToId,
        estimatedValue: estimatedValueRaw ? estimatedValueRaw : null,
      },
    });

    if (wasMissedCall) {
      await tx.communication.create({
        data: {
          companyId: session.companyId,
          customerId,
          leadId: lead.id,
          channel: "PHONE_CALL",
          direction: "INBOUND",
          status: "MISSED",
        },
      });
    }

    return { leadId: lead.id, customerId };
  });

  if (wasMissedCall && phone) {
    await runActiveAutomations(
      session.companyId,
      "MISSED_CALL",
      { phone, company: company.name },
      { customerId: finalCustomerId, leadId }
    );
  }

  await runActiveAutomations(
    session.companyId,
    "LEAD_CREATED",
    { phone, email: email ?? "", company: company.name },
    { customerId: finalCustomerId, leadId }
  );

  revalidatePath("/leads");
  redirect(`/leads/${leadId}`);
}

export async function updateLeadStatusAction(leadId: string, status: LeadStatus) {
  const session = await requireSession();
  assertRole(session, OFFICE_ROLES);

  await prisma.lead.update({
    where: { id: leadId, companyId: session.companyId },
    data: { status },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function markLeadLostAction(leadId: string, reason: string) {
  const session = await requireSession();
  assertRole(session, OFFICE_ROLES);

  await prisma.lead.update({
    where: { id: leadId, companyId: session.companyId },
    data: { status: "LOST", lostReason: reason || null },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}
