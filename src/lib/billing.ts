import "server-only";
import { prisma } from "@/lib/prisma";

/** Flat monthly price for the paid plan, in whole dollars. */
export const SUBSCRIPTION_PRICE_DOLLARS = 11;

/**
 * Signup is free, and so is a company's very first estimate — after that,
 * every new estimate requires an active subscription. The free slot is
 * claimed with an atomic conditional update (not a read-then-write) so two
 * concurrent "create estimate" submissions can't both slip through free.
 *
 * Returns true if the caller may proceed with creating a new estimate.
 */
export async function claimFreeEstimateOrRequireSubscription(companyId: string): Promise<boolean> {
  const claimed = await prisma.company.updateMany({
    where: { id: companyId, freeQuoteUsedAt: null },
    data: { freeQuoteUsedAt: new Date() },
  });
  if (claimed.count > 0) return true;

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  return company.subscriptionStatus === "ACTIVE";
}

export async function hasBillingAccess(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  return company.freeQuoteUsedAt === null || company.subscriptionStatus === "ACTIVE";
}
