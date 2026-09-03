import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstimateStartForm } from "./estimate-start-form";

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; customerId?: string }>;
}) {
  const session = await requireSession();
  const { leadId, customerId } = await searchParams;

  const [customers, lead] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: session.companyId },
      include: { properties: { select: { id: true, addressLine1: true, city: true } } },
      orderBy: { createdAt: "desc" },
    }),
    leadId
      ? prisma.lead.findFirst({ where: { id: leadId, companyId: session.companyId } })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New estimate</h1>
        <p className="text-sm text-muted-foreground">Pick who this is for, then build the estimate.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EstimateStartForm
            customers={customers}
            defaultCustomerId={lead?.customerId ?? customerId}
            defaultPropertyId={lead?.propertyId ?? undefined}
            defaultTitle={lead?.requestedService}
            leadId={leadId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
