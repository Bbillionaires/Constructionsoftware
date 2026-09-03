import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { PriceBookItemForm } from "../price-book-item-form";

export default async function PriceBookItemPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const [item, categories] = await Promise.all([
    prisma.priceBookItem.findFirst({ where: { id, companyId: session.companyId } }),
    prisma.serviceCategory.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
  ]);

  if (!item) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{item.name}</h1>
      <PriceBookItemForm
        categories={categories}
        item={{
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          standardPrice: item.standardPrice.toString(),
          minimumPrice: item.minimumPrice?.toString() ?? null,
          expectedLaborHours: item.expectedLaborHours.toString(),
          expectedCrewSize: item.expectedCrewSize,
          materialAllowance: item.materialAllowance?.toString() ?? null,
          defaultMarkupPercent: item.defaultMarkupPercent.toString(),
          targetMarginPercent: item.targetMarginPercent.toString(),
          estimatedDurationMinutes: item.estimatedDurationMinutes,
          requiredSkills: item.requiredSkills,
          warrantyDays: item.warrantyDays,
          permitWarning: item.permitWarning,
          isActive: item.isActive,
        }}
      />
    </div>
  );
}
