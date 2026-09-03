"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, ESTIMATOR_ROLES, MANAGER_ROLES } from "@/lib/session";

function parseSkills(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createOrUpdatePriceBookItemAction(itemId: string | null, formData: FormData) {
  const session = await requireSession();
  assertRole(session, ESTIMATOR_ROLES);

  let categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const newCategoryName = String(formData.get("newCategoryName") ?? "").trim();
  if (!categoryId && newCategoryName) {
    const category = await prisma.serviceCategory.create({
      data: { companyId: session.companyId, name: newCategoryName },
    });
    categoryId = category.id;
  }

  const data = {
    companyId: session.companyId,
    categoryId,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    standardPrice: String(formData.get("standardPrice") ?? "0"),
    minimumPrice: formData.get("minimumPrice") ? String(formData.get("minimumPrice")) : null,
    expectedLaborHours: String(formData.get("expectedLaborHours") ?? "1"),
    expectedCrewSize: Number(formData.get("expectedCrewSize") ?? 1),
    materialAllowance: formData.get("materialAllowance") ? String(formData.get("materialAllowance")) : null,
    defaultMarkupPercent: String(formData.get("defaultMarkupPercent") ?? "50"),
    targetMarginPercent: String(formData.get("targetMarginPercent") ?? "45"),
    estimatedDurationMinutes: formData.get("estimatedDurationMinutes")
      ? Number(formData.get("estimatedDurationMinutes"))
      : null,
    requiredSkills: parseSkills(String(formData.get("requiredSkills") ?? "")),
    warrantyDays: formData.get("warrantyDays") ? Number(formData.get("warrantyDays")) : null,
    permitWarning: String(formData.get("permitWarning") ?? "").trim() || null,
    isActive: formData.get("isActive") === "on",
  };

  if (!data.name) throw new Error("Service name is required.");

  if (itemId) {
    await prisma.priceBookItem.update({ where: { id: itemId, companyId: session.companyId }, data });
  } else {
    await prisma.priceBookItem.create({ data });
  }

  revalidatePath("/price-book");
  redirect("/price-book");
}

export async function deletePriceBookItemAction(itemId: string) {
  const session = await requireSession();
  assertRole(session, MANAGER_ROLES);

  await prisma.priceBookItem.delete({ where: { id: itemId, companyId: session.companyId } });
  revalidatePath("/price-book");
  redirect("/price-book");
}
