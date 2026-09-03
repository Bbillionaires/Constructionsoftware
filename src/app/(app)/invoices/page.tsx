import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/money";

export default async function InvoicesPage() {
  const session = await requireSession();

  const invoices = await prisma.invoice.findMany({
    where: { companyId: session.companyId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">Generated automatically when a job is completed.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link href={`/invoices/${inv.id}`} className="hover:underline">
                      INV-{inv.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {inv.customer.firstName} {inv.customer.lastName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "PAID" ? "secondary" : "outline"}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(inv.totalAmount)}</TableCell>
                  <TableCell>{formatCurrency(inv.amountPaid)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(inv.balanceDue)}</TableCell>
                  <TableCell>{inv.dueDate?.toLocaleDateString() ?? "—"}</TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No invoices yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
