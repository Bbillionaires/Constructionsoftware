import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/money";
import { recordManualPaymentAction } from "@/lib/actions/invoices";
import { Copy } from "lucide-react";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      job: { include: { property: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!invoice) notFound();

  const recordPayment = recordManualPaymentAction.bind(null, invoice.id);
  const portalLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invoice-portal/${invoice.publicToken}`;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">INV-{invoice.number}</h1>
            <p className="text-sm text-muted-foreground">
              {invoice.customer.firstName} {invoice.customer.lastName} ·{" "}
              <Link href={`/jobs/${invoice.jobId}`} className="underline">
                JOB-{invoice.job.number}
              </Link>
            </p>
          </div>
          <Badge variant={invoice.status === "PAID" ? "secondary" : "outline"}>{invoice.status}</Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Unit price</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((li) => (
                  <tr key={li.id} className="border-b last:border-0">
                    <td className="p-3">{li.description}</td>
                    <td className="p-3 text-right">{li.quantity.toString()}</td>
                    <td className="p-3 text-right">{formatCurrency(li.unitPrice)}</td>
                    <td className="p-3 text-right">{formatCurrency(li.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span>
                  {p.method} · {p.provider} · {p.paidAt.toLocaleDateString()}
                </span>
                <span>{formatCurrency(p.amount)}</span>
              </div>
            ))}
            {invoice.payments.length === 0 && (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <Row label="Subtotal" value={formatCurrency(invoice.subtotal)} />
            <Row label="Tax" value={formatCurrency(invoice.taxAmount)} />
            <Row label="Total" value={formatCurrency(invoice.totalAmount)} bold />
            <Row label="Paid" value={formatCurrency(invoice.amountPaid)} />
            <Row label="Balance due" value={formatCurrency(invoice.balanceDue)} bold />
          </CardContent>
        </Card>

        {Number(invoice.balanceDue) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form action={recordPayment} className="space-y-2">
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder={`Full balance (${formatCurrency(invoice.balanceDue)})`}
                />
                <select name="method" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="CASH">
                  <option value="CASH">Cash</option>
                  <option value="CHECK">Check</option>
                  <option value="CARD">Card (manual)</option>
                  <option value="ACH">ACH</option>
                  <option value="OTHER">Other</option>
                </select>
                <Button type="submit" className="w-full">
                  Record payment
                </Button>
              </form>
              <Button
                variant="outline"
                className="w-full"
                render={<a href={portalLink} target="_blank" rel="noreferrer" />}
                nativeButton={false}
              >
                <Copy className="mr-1 h-4 w-4" /> Open customer payment link
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
