import { NextRequest, NextResponse } from "next/server";
import { processDueFollowUps, processDueReviewRequests } from "@/lib/automations";

/**
 * Intended for an external scheduler (Vercel Cron, OS cron, etc.) to hit on
 * an interval, since this app has no background job queue. Protect it with
 * CRON_SECRET before exposing it publicly — the in-app "Run due follow-ups
 * now" button on the Estimate Recovery Center calls the same underlying
 * functions directly and needs no secret since it goes through normal auth.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = request.nextUrl.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [followUps, reviews] = await Promise.all([processDueFollowUps(), processDueReviewRequests()]);
  return NextResponse.json({ followUps, reviews });
}
