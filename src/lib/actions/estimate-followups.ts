"use server";

import { revalidatePath } from "next/cache";
import { requireSession, OFFICE_ROLES, assertRole } from "@/lib/session";
import { processDueFollowUps, processDueReviewRequests } from "@/lib/automations";

export async function runDueFollowUpsAction() {
  const session = await requireSession();
  assertRole(session, OFFICE_ROLES);

  const [followUps, reviews] = await Promise.all([processDueFollowUps(), processDueReviewRequests()]);
  revalidatePath("/estimates/recovery");
  return { followUps, reviews };
}
