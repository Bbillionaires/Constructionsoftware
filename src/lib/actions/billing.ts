"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, MANAGER_ROLES } from "@/lib/session";
import { getSubscriptionProvider } from "@/lib/adapters/subscriptions";

export async function subscribeAction(formData: FormData) {
  const session = await requireSession();
  assertRole(session, MANAGER_ROLES);

  const cardSourceId = String(formData.get("cardSourceId") ?? "").trim();
  if (!cardSourceId) throw new Error("Missing card details — please try again.");

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });

  const result = await getSubscriptionProvider().subscribe({
    companyName: company.name,
    email: company.email ?? session.userEmail,
    cardSourceId,
  });

  await prisma.company.update({
    where: { id: session.companyId },
    data: {
      subscriptionStatus: "ACTIVE",
      squareCustomerId: result.customerId,
      squareCardId: result.cardId,
      squareSubscriptionId: result.subscriptionId,
      subscriptionStartedAt: new Date(),
    },
  });

  revalidatePath("/billing");
  redirect("/estimates/new");
}
