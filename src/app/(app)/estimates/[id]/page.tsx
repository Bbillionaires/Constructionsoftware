import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { decToNum } from "@/lib/estimate-totals";
import { EstimateBuilder } from "./estimate-builder";

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const [estimate, priceBookItems, company] = await Promise.all([
    prisma.estimate.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        customer: true,
        property: true,
        options: { include: { lineItems: true }, orderBy: { sortOrder: "asc" } },
        job: { select: { id: true } },
      },
    }),
    prisma.priceBookItem.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.company.findUniqueOrThrow({ where: { id: session.companyId } }),
  ]);

  if (!estimate) notFound();

  const initialOptions = estimate.options.map((o) => ({
    id: o.id,
    tier: o.tier,
    label: o.label,
    description: o.description ?? "",
    isSelected: o.isSelected,
    lineItems: o.lineItems.map((li) => ({
      id: li.id,
      type: li.type,
      description: li.description,
      supplier: li.supplier,
      quantity: decToNum(li.quantity),
      unitCost: decToNum(li.unitCost),
      unitPrice: decToNum(li.unitPrice),
      isOptionalUpgrade: li.isOptionalUpgrade,
      priceBookItemId: li.priceBookItemId,
    })),
  }));

  return (
    <EstimateBuilder
      estimateId={estimate.id}
      status={estimate.status}
      publicToken={estimate.publicToken}
      initialTitle={estimate.title}
      initialOptions={initialOptions}
      initialTaxPercent={decToNum(estimate.taxPercent)}
      initialDepositPercent={estimate.depositPercent != null ? decToNum(estimate.depositPercent) : null}
      initialNotes={estimate.notes ?? ""}
      initialTerms={estimate.terms ?? ""}
      priceBookItems={priceBookItems.map((p) => ({
        id: p.id,
        name: p.name,
        expectedLaborHours: decToNum(p.expectedLaborHours),
        materialAllowance: decToNum(p.materialAllowance),
        defaultMarkupPercent: decToNum(p.defaultMarkupPercent),
        targetMarginPercent: decToNum(p.targetMarginPercent),
      }))}
      companyDefaultLaborRate={decToNum(company.defaultLaborRate)}
      companyTargetMargin={decToNum(company.targetMarginPercent)}
      customerLabel={`${estimate.customer.firstName} ${estimate.customer.lastName}`}
      propertyLabel={`${estimate.property.addressLine1}, ${estimate.property.city}`}
      hasJob={!!estimate.job}
      voiceTranscript={estimate.voiceTranscript}
    />
  );
}
