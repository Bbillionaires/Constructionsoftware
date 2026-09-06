import { lineTotalCents, fromCents } from "@/lib/money";
import type { LineItemType } from "@prisma/client";

/**
 * Deterministic estimate math. All financial calculations in this app are
 * plain application code — nothing here is ever inferred or adjusted by AI.
 * Markup and margin are related but different:
 *   markup % = profit / cost   (how much you added on top of cost)
 *   margin % = profit / price  (what share of the sale is profit)
 */

export type LineItemInput = {
  type: LineItemType;
  description: string;
  supplier?: string | null;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  isOptionalUpgrade: boolean;
};

export type OptionTotals = {
  directCostCents: number;
  sellingPriceCents: number;
  laborCostCents: number;
  materialCostCents: number;
  otherCostCents: number;
  upgradeSellingPriceCents: number;
  grossProfitCents: number;
  markupPercent: number;
  marginPercent: number;
};

export function calcOptionTotals(lineItems: LineItemInput[]): OptionTotals {
  let directCostCents = 0;
  let sellingPriceCents = 0;
  let laborCostCents = 0;
  let materialCostCents = 0;
  let otherCostCents = 0;
  let upgradeSellingPriceCents = 0;

  for (const item of lineItems) {
    const costCents = lineTotalCents(item.quantity, item.unitCost);
    const priceCents = lineTotalCents(item.quantity, item.unitPrice);

    if (item.isOptionalUpgrade) {
      upgradeSellingPriceCents += priceCents;
      continue;
    }

    directCostCents += costCents;
    sellingPriceCents += priceCents;

    if (item.type === "LABOR") laborCostCents += costCents;
    else if (item.type === "MATERIAL") materialCostCents += costCents;
    else otherCostCents += costCents;
  }

  const grossProfitCents = sellingPriceCents - directCostCents;
  const markupPercent = directCostCents > 0 ? (grossProfitCents / directCostCents) * 100 : 0;
  const marginPercent = sellingPriceCents > 0 ? (grossProfitCents / sellingPriceCents) * 100 : 0;

  return {
    directCostCents,
    sellingPriceCents,
    laborCostCents,
    materialCostCents,
    otherCostCents,
    upgradeSellingPriceCents,
    grossProfitCents,
    markupPercent,
    marginPercent,
  };
}

export type EstimateTotals = OptionTotals & {
  discountCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
};

export function calcEstimateTotals(
  lineItems: LineItemInput[],
  opts: { discountDollars?: number; taxPercent?: number; depositPercent?: number; depositFlatDollars?: number }
): EstimateTotals {
  const option = calcOptionTotals(lineItems);
  const discountCents = Math.round((opts.discountDollars ?? 0) * 100);
  const taxableCents = Math.max(option.sellingPriceCents - discountCents, 0);
  const taxCents = Math.round(taxableCents * ((opts.taxPercent ?? 0) / 100));
  const totalCents = taxableCents + taxCents;

  const depositCents =
    opts.depositFlatDollars != null
      ? Math.round(opts.depositFlatDollars * 100)
      : Math.round(totalCents * ((opts.depositPercent ?? 0) / 100));

  return {
    ...option,
    discountCents,
    taxCents,
    totalCents,
    depositCents,
  };
}

export type MarginWarning = {
  level: "warning" | "danger";
  message: string;
};

export function getMarginWarnings(
  totals: OptionTotals,
  targetMarginPercent: number
): MarginWarning[] {
  const warnings: MarginWarning[] = [];

  if (totals.sellingPriceCents > 0 && totals.marginPercent < targetMarginPercent - 15) {
    warnings.push({
      level: "danger",
      message: `Low margin: ${totals.marginPercent.toFixed(1)}% is well below the ${targetMarginPercent}% target.`,
    });
  } else if (totals.sellingPriceCents > 0 && totals.marginPercent < targetMarginPercent) {
    warnings.push({
      level: "warning",
      message: `Price below target margin: ${totals.marginPercent.toFixed(1)}% vs ${targetMarginPercent}% target.`,
    });
  }

  if (totals.grossProfitCents < 0) {
    warnings.push({ level: "danger", message: "This estimate is priced below direct cost." });
  }

  return warnings;
}

export function centsToOption(totals: OptionTotals) {
  return {
    directCost: fromCents(totals.directCostCents),
    sellingPrice: fromCents(totals.sellingPriceCents),
    laborCost: fromCents(totals.laborCostCents),
    materialCost: fromCents(totals.materialCostCents),
    otherCost: fromCents(totals.otherCostCents),
    upgradeSellingPrice: fromCents(totals.upgradeSellingPriceCents),
    grossProfit: fromCents(totals.grossProfitCents),
    markupPercent: totals.markupPercent,
    marginPercent: totals.marginPercent,
  };
}
