"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, OFFICE_ROLES } from "@/lib/session";

export async function createCustomerAction(formData: FormData) {
  const session = await requireSession();
  assertRole(session, OFFICE_ROLES);

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const companyName = String(formData.get("companyName") ?? "").trim() || null;
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();

  if (!firstName || !lastName) throw new Error("First and last name are required.");

  const customer = await prisma.customer.create({
    data: {
      companyId: session.companyId,
      firstName,
      lastName,
      email,
      phone,
      companyName,
      properties: addressLine1
        ? { create: { companyId: session.companyId, addressLine1, city, state, postalCode } }
        : undefined,
    },
  });

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function addPropertyAction(customerId: string, formData: FormData) {
  const session = await requireSession();
  assertRole(session, OFFICE_ROLES);

  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const accessNotes = String(formData.get("accessNotes") ?? "").trim() || null;

  if (!addressLine1 || !city || !state || !postalCode) {
    throw new Error("Full address is required.");
  }

  await prisma.property.create({
    data: {
      companyId: session.companyId,
      customerId,
      addressLine1,
      city,
      state,
      postalCode,
      accessNotes,
    },
  });

  revalidatePath(`/customers/${customerId}`);
}

export async function addCommunicationAction(
  customerId: string,
  formData: FormData,
  opts?: { leadId?: string; jobId?: string }
) {
  const session = await requireSession();

  const body = String(formData.get("body") ?? "").trim();
  const channel = String(formData.get("channel") ?? "MANUAL_NOTE");
  if (!body) return;

  await prisma.communication.create({
    data: {
      companyId: session.companyId,
      customerId,
      leadId: opts?.leadId,
      jobId: opts?.jobId,
      channel: channel as "SMS" | "EMAIL" | "PHONE_CALL" | "AUTOMATED" | "MANUAL_NOTE",
      direction: "OUTBOUND",
      status: "SENT",
      body,
      createdById: session.userId,
    },
  });

  if (opts?.leadId) {
    await prisma.lead.updateMany({
      where: { id: opts.leadId, firstResponseAt: null },
      data: { firstResponseAt: new Date() },
    });
    revalidatePath(`/leads/${opts.leadId}`);
  }
  revalidatePath(`/customers/${customerId}`);
}
