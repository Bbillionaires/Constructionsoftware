import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decToNum } from "@/lib/estimate-totals";
import { markEstimateViewedAction } from "@/lib/actions/portal";
import { ApproveForm } from "./approve-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { publicToken: token },
    include: {
      company: true,
      customer: true,
      property: true,
      job: { select: { id: true } },
      options: { include: { lineItems: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!estimate) notFound();

  if (estimate.job) redirect(`/portal/${token}/thank-you?jobId=${estimate.job.id}`);
  if (estimate.status === "APPROVED") redirect(`/portal/${token}/deposit`);

  if (estimate.status === "SENT") {
    await markEstimateViewedAction(token);
  }

  if (estimate.status === "DECLINED" || estimate.status === "EXPIRED") {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>
              {estimate.status === "DECLINED" ? "Estimate declined" : "This estimate has expired"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact {estimate.company.name} at {estimate.company.phone ?? estimate.company.email} if you&apos;d
              like to revisit this.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const options = estimate.options.map((o) => ({
    id: o.id,
    label: o.label,
    description: o.description,
    lineItems: o.lineItems.map((li) => ({
      id: li.id,
      type: li.type,
      description: li.description,
      quantity: decToNum(li.quantity),
      unitPrice: decToNum(li.unitPrice),
      isOptionalUpgrade: li.isOptionalUpgrade,
    })),
  }));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        {estimate.company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={estimate.company.logoUrl} alt={estimate.company.name} className="mx-auto mb-2 h-10" />
        )}
        <h1 className="text-xl font-semibold">{estimate.company.name}</h1>
        <p className="text-sm text-muted-foreground">
          Estimate for {estimate.customer.firstName} {estimate.customer.lastName} ·{" "}
          {estimate.property.addressLine1}, {estimate.property.city}
        </p>
      </div>

      <ApproveForm token={token} options={options} taxPercent={decToNum(estimate.taxPercent)} />

      {(estimate.notes || estimate.terms) && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
            {estimate.notes && <p>{estimate.notes}</p>}
            {estimate.terms && <p className="text-xs">{estimate.terms}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
