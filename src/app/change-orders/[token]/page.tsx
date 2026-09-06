import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decToNum } from "@/lib/estimate-totals";
import { formatCurrency } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangeOrderApproveForm } from "./change-order-approve-form";

export default async function ChangeOrderPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const changeOrder = await prisma.changeOrder.findUnique({
    where: { publicToken: token },
    include: { company: true, job: { include: { customer: true, property: true } } },
  });
  if (!changeOrder) notFound();

  const { company, job } = changeOrder;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        {company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt={company.name} className="mx-auto mb-2 h-10" />
        )}
        <h1 className="text-xl font-semibold">{company.name}</h1>
        <p className="text-sm text-muted-foreground">
          Change order for {job.customer.firstName} {job.customer.lastName} · {job.property.addressLine1},{" "}
          {job.property.city}
        </p>
      </div>

      {changeOrder.status === "PENDING" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional work requested</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{changeOrder.description}</p>
              <div className="space-y-1 border-t pt-3">
                {decToNum(changeOrder.laborAmount) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Labor</span>
                    <span>{formatCurrency(changeOrder.laborAmount)}</span>
                  </div>
                )}
                {decToNum(changeOrder.materialAmount) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Materials</span>
                    <span>{formatCurrency(changeOrder.materialAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(changeOrder.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <ChangeOrderApproveForm token={token} totalAmount={decToNum(changeOrder.totalAmount)} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{changeOrder.status === "APPROVED" ? "Change order approved" : "Change order declined"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {changeOrder.status === "APPROVED"
                ? "Thanks — this has been added to your job."
                : `Contact ${company.name} at ${company.phone ?? company.email ?? "your project office"} if you'd like to revisit this.`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
