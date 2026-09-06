import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, MANAGER_ROLES } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SUBSCRIPTION_PRICE_DOLLARS } from "@/lib/billing";
import { SubscribeForm } from "./subscribe-form";

export default async function BillingPage() {
  const session = await requireSession();
  assertRole(session, MANAGER_ROLES);

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });

  // Sandbox mode runs the entire real flow (tokenization, customer/card/
  // subscription creation) against Square's separate test environment — no
  // real money moves. It's a different Square app/account, not a bypass of
  // the real one, so it's safe to leave available without gating it off from
  // real customers who might otherwise never subscribe for real.
  const isSandbox = process.env.SQUARE_ENVIRONMENT === "sandbox";
  const squareApplicationId = isSandbox
    ? process.env.NEXT_PUBLIC_SQUARE_SANDBOX_APPLICATION_ID
    : process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const squareLocationId = isSandbox ? process.env.SQUARE_SANDBOX_LOCATION_ID : process.env.SQUARE_LOCATION_ID;
  const liveCardCaptureConfigured = Boolean(
    squareApplicationId &&
      squareLocationId &&
      (isSandbox ? process.env.SQUARE_SANDBOX_ACCESS_TOKEN : process.env.SQUARE_ACCESS_TOKEN)
  );

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          Billing
          {isSandbox && <Badge variant="secondary">Test mode — no real charge</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your first estimate is free. After that, ${SUBSCRIPTION_PRICE_DOLLARS}/month keeps everything running.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Plan status
            <Badge variant={company.subscriptionStatus === "ACTIVE" ? "default" : "outline"}>
              {company.subscriptionStatus}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {company.subscriptionStatus === "ACTIVE" ? (
            <p className="text-sm text-muted-foreground">
              You&apos;re subscribed at ${SUBSCRIPTION_PRICE_DOLLARS}/month. Thanks for keeping the lights on.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {company.freeQuoteUsedAt
                  ? "Your free estimate has been used. Subscribe to create another estimate or send the one you already have."
                  : "You haven't used your free estimate yet — you don't need to subscribe until you create a second one."}
              </p>
              <SubscribeForm
                liveCardCaptureConfigured={liveCardCaptureConfigured}
                squareApplicationId={squareApplicationId}
                squareLocationId={squareLocationId}
                sandbox={isSandbox}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
