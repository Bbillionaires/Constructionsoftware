import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EstimateStartForm } from "./estimate-start-form";
import { VoiceEstimateForm } from "./voice-estimate-form";

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
        <CardContent className="pt-6">
          <Tabs defaultValue="type">
            <TabsList className="mb-4">
              <TabsTrigger value="type">Type it</TabsTrigger>
              <TabsTrigger value="speak">Speak it</TabsTrigger>
            </TabsList>
            <TabsContent value="type">
              <EstimateStartForm
                customers={customers}
                defaultCustomerId={lead?.customerId ?? customerId}
                defaultPropertyId={lead?.propertyId ?? undefined}
                defaultTitle={lead?.requestedService}
                leadId={leadId}
              />
            </TabsContent>
            <TabsContent value="speak">
              <VoiceEstimateForm
                customers={customers}
                defaultCustomerId={lead?.customerId ?? customerId}
                leadId={leadId}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
