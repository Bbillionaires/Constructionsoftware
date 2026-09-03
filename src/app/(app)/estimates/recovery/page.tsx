import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/money";
import { getEstimateTotals, OPEN_ESTIMATE_STATUSES } from "@/lib/estimate-totals";
import { fromCents } from "@/lib/money";
import { RunFollowUpsButton } from "./run-followups-button";

function currentTimeMs() {
  return Date.now();
}

function priorityFor(ageDays: number, value: number): "HOT" | "WARM" | "COLD" {
  if (ageDays <= 3 && value >= 300) return "HOT";
  if (ageDays <= 7) return "WARM";
  return "COLD";
}

const PRIORITY_COLOR: Record<string, string> = {
  HOT: "bg-red-100 text-red-800",
  WARM: "bg-amber-100 text-amber-800",
  COLD: "bg-blue-100 text-blue-800",
};

export default async function RecoveryCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const session = await requireSession();
  const { sort } = await searchParams;

  const [openEstimates, recoveredEstimates] = await Promise.all([
    prisma.estimate.findMany({
      where: { companyId: session.companyId, status: { in: [...OPEN_ESTIMATE_STATUSES] } },
      include: {
        customer: true,
        property: true,
        options: { include: { lineItems: true } },
        followUps: true,
        estimator: { select: { name: true } },
      },
    }),
    prisma.estimate.findMany({
      where: { companyId: session.companyId, status: "APPROVED" },
      include: { options: { include: { lineItems: true } }, followUps: true },
    }),
  ]);

  const now = currentTimeMs();
  const rows = openEstimates.map((e) => {
    const totals = getEstimateTotals(e);
    const value = fromCents(totals.totalCents);
    const referenceDate = e.sentAt ?? e.createdAt;
    const ageDays = Math.floor((now - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      estimate: e,
      value,
      ageDays,
      priority: priorityFor(ageDays, value),
      lastFollowUp: e.followUps.filter((f) => f.status === "SENT").sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))[0],
    };
  });

  if (sort === "age") rows.sort((a, b) => b.ageDays - a.ageDays);
  else rows.sort((a, b) => b.value - a.value);

  const openValue = rows.reduce((sum, r) => sum + r.value, 0);
  const needsFollowUp = rows
    .filter((r) => r.estimate.status === "FOLLOW_UP_DUE")
    .reduce((sum, r) => sum + r.value, 0);
  const noResponse3 = rows.filter((r) => r.ageDays >= 3).reduce((sum, r) => sum + r.value, 0);
  const noResponse7 = rows.filter((r) => r.ageDays >= 7).reduce((sum, r) => sum + r.value, 0);
  const recoveredValue = recoveredEstimates
    .filter((e) => e.followUps.some((f) => f.status === "SENT"))
    .reduce((sum, e) => sum + fromCents(getEstimateTotals(e).totalCents), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Estimate Recovery Center</h1>
          <p className="text-sm text-muted-foreground">Money sitting in open estimates — work the list like a sales queue.</p>
        </div>
        <RunFollowUpsButton />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Open estimates" value={formatCurrency(openValue)} />
        <SummaryCard label="Needs follow-up" value={formatCurrency(needsFollowUp)} />
        <SummaryCard label="No response 3+ days" value={formatCurrency(noResponse3)} />
        <SummaryCard label="No response 7+ days" value={formatCurrency(noResponse7)} />
      </div>
      <SummaryCard label="Recovered through follow-up (approved)" value={formatCurrency(recoveredValue)} wide />

      <div className="flex gap-2 text-sm">
        <Link href="/estimates/recovery?sort=value" className={sort !== "age" ? "font-semibold underline" : "text-muted-foreground"}>
          Sort by value
        </Link>
        <Link href="/estimates/recovery?sort=age" className={sort === "age" ? "font-semibold underline" : "text-muted-foreground"}>
          Sort by age
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Estimator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.estimate.id}>
                  <TableCell>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[r.priority]}`}>
                      {r.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/estimates/${r.estimate.id}`} className="hover:underline">
                      {r.estimate.customer.firstName} {r.estimate.customer.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{r.estimate.title}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(r.value)}</TableCell>
                  <TableCell>{formatPercent(getEstimateTotals(r.estimate).marginPercent)}</TableCell>
                  <TableCell>{r.ageDays}d</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.estimate.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>{r.estimate.estimator.name}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No open estimates right now — great work!
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

function SummaryCard({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <Card className={wide ? "col-span-full" : ""}>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
