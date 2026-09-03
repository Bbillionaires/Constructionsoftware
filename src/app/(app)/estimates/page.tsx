import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/money";
import { getEstimateTotals } from "@/lib/estimate-totals";
import { fromCents } from "@/lib/money";
import { Plus } from "lucide-react";

export default async function EstimatesPage() {
  const session = await requireSession();

  const estimates = await prisma.estimate.findMany({
    where: { companyId: session.companyId },
    include: {
      customer: true,
      property: true,
      options: { include: { lineItems: true } },
      estimator: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estimates</h1>
          <p className="text-sm text-muted-foreground">Every estimate, its status, and its margin.</p>
        </div>
        <Button render={<Link href="/estimates/new" />} nativeButton={false}>
          <Plus className="mr-1 h-4 w-4" /> New estimate
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>Estimator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map((e) => {
                const totals = getEstimateTotals(e);
                return (
                  <TableRow key={e.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/estimates/${e.id}`} className="hover:underline">
                        EST-{e.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {e.customer.firstName} {e.customer.lastName}
                      <div className="text-xs text-muted-foreground">{e.property.addressLine1}</div>
                    </TableCell>
                    <TableCell>{e.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{e.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(fromCents(totals.totalCents))}</TableCell>
                    <TableCell>{formatPercent(totals.marginPercent)}</TableCell>
                    <TableCell>{e.estimator.name}</TableCell>
                  </TableRow>
                );
              })}
              {estimates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No estimates yet.
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
