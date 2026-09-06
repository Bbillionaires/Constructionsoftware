"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, MANAGER_ROLES } from "@/lib/session";

export async function updateCompanyProfileAction(formData: FormData) {
  const session = await requireSession();
  assertRole(session, MANAGER_ROLES);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Company name is required.");

  const targetMarginPercent = String(formData.get("targetMarginPercent") ?? "45");
  const defaultLaborRate = String(formData.get("defaultLaborRate") ?? "35");

  await prisma.company.update({
    where: { id: session.companyId },
    data: {
      name,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      addressLine1: String(formData.get("addressLine1") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      state: String(formData.get("state") ?? "").trim() || null,
      postalCode: String(formData.get("postalCode") ?? "").trim() || null,
      timezone: String(formData.get("timezone") ?? "America/New_York"),
      logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
      targetMarginPercent,
      defaultLaborRate,
    },
  });

  revalidatePath("/settings");
}
