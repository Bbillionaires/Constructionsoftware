import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/money";
import { startInvoiceCheckoutAction } from "@/lib/actions/invoices";
import { CheckCircle2 } from "lucide-react";

export default async function InvoicePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: token },
    include: { company: true, customer: true, lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) notFound();

  const action = startInvoiceCheckoutAction.bind(null, token);
  const balanceDue = Number(invoice.balanceDue);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{invoice.company.name}</h1>
        <p className="text-sm text-muted-foreground">
          Invoice INV-{invoice.number} for {invoice.customer.firstName} {invoice.customer.lastName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice summary</CardTitle>
          <CardDescription>
            <Badge variant={invoice.status === "PAID" ? "secondary" : "outline"}>{invoice.status}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoice.lineItems.map((li) => (
            <div key={li.id} className="flex justify-between text-sm">
              <span>{li.description}</span>
              <span>{formatCurrency(li.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 text-sm font-semibold">
            <span>Total</span>
            <span>{formatCurrency(invoice.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Paid</span>
            <span>{formatCurrency(invoice.amountPaid)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <span>Balance due</span>
            <span>{formatCurrency(invoice.balanceDue)}</span>
          </div>
        </CardContent>
      </Card>

      {balanceDue > 0 ? (
        <form action={action}>
          <Button type="submit" className="w-full">
            Pay {formatCurrency(balanceDue)}
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" /> Paid in full — thank you!
        </div>
      )}
    </div>
  );
}
