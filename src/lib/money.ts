/**
 * All currency math in this app happens in integer cents to avoid
 * floating-point rounding drift. Never do `a * b` directly on dollar
 * floats for money — convert to cents, operate, convert back.
 */

/** Accepts a number, numeric string, Prisma Decimal, null, or undefined. */
function toNumber(amount: unknown): number {
  if (amount == null) return 0;
  if (typeof amount === "number") return amount;
  const n = parseFloat(String(amount));
  return Number.isFinite(n) ? n : 0;
}

export function toCents(dollars: unknown): number {
  return Math.round(toNumber(dollars) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatCurrency(amount: unknown): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(toNumber(amount));
}

export function formatPercent(amount: unknown, digits = 1): string {
  return `${toNumber(amount).toFixed(digits)}%`;
}

/** quantity (fractional, e.g. hours) x unit price (dollars) -> line total in cents */
export function lineTotalCents(quantity: number, unitDollars: number): number {
  const unitCents = toCents(unitDollars);
  return Math.round(quantity * unitCents);
}
