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
  const squareApplicationId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const liveCardCaptureConfigured = Boolean(
    squareApplicationId && process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID
  );

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
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
                squareLocationId={process.env.SQUARE_LOCATION_ID}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
