import type { Estimate, EstimateOption, EstimateLineItem } from "@prisma/client";
import { calcEstimateTotals, type EstimateTotals } from "@/lib/estimate-calc";
import { fromCents } from "@/lib/money";

export type EstimateWithOptions = Estimate & {
  options: (EstimateOption & { lineItems: EstimateLineItem[] })[];
};

export function decToNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === "number") return d;
  // Prisma.Decimal has a toNumber() method
  const maybe = d as { toNumber?: () => number };
  return typeof maybe.toNumber === "function" ? maybe.toNumber() : Number(d);
}

/** The option whose totals represent "the" price of the estimate right now. */
export function primaryOption(estimate: EstimateWithOptions) {
  if (estimate.options.length === 0) return undefined;
  return (
    estimate.options.find((o) => o.isSelected) ??
    [...estimate.options].sort((a, b) => a.sortOrder - b.sortOrder)[0]
  );
}

export function getEstimateTotals(estimate: EstimateWithOptions): EstimateTotals {
  const option = primaryOption(estimate);
  const lineItems = (option?.lineItems ?? []).map((li) => ({
    type: li.type,
    description: li.description,
    quantity: decToNum(li.quantity),
    unitCost: decToNum(li.unitCost),
    unitPrice: decToNum(li.unitPrice),
    isOptionalUpgrade: li.isOptionalUpgrade,
  }));

  return calcEstimateTotals(lineItems, {
    taxPercent: decToNum(estimate.taxPercent),
    depositPercent: estimate.depositPercent != null ? decToNum(estimate.depositPercent) : undefined,
    depositFlatDollars: estimate.depositAmount != null ? decToNum(estimate.depositAmount) : undefined,
  });
}

export function getEstimateTotalDollars(estimate: EstimateWithOptions) {
  const totals = getEstimateTotals(estimate);
  return fromCents(totals.totalCents);
}

export const OPEN_ESTIMATE_STATUSES = ["SENT", "VIEWED", "OPEN", "FOLLOW_UP_DUE"] as const;
