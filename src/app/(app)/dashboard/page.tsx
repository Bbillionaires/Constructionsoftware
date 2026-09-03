import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getDashboardData } from "@/lib/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/money";
import { AlertTriangle, Inbox, FileWarning, Camera } from "lucide-react";

export default async function DashboardPage() {
  const session = await requireSession();
  const d = await getDashboardData(session.companyId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Good to see you, {session.userName.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">{session.companyName} — here&apos;s where things stand.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Today's revenue" value={formatCurrency(d.todaysRevenue)} />
        <Stat label="Cash collected (mo.)" value={formatCurrency(d.cashCollectedMonth)} />
        <Stat label="Revenue booked (mo.)" value={formatCurrency(d.revenueMonth)} />
        <Stat label="Outstanding invoices" value={formatCurrency(d.outstandingInvoices)} />
        <Stat label="Gross profit (mo.)" value={formatCurrency(d.grossProfitMonth)} />
        <Stat label="Jobs today" value={String(d.jobsToday)} />
        <Stat label="Jobs this week" value={String(d.jobsThisWeek)} />
        <Stat label="Jobs completed (mo.)" value={String(d.jobsCompletedMonth)} />
        <Stat label="Average ticket" value={formatCurrency(d.averageTicket)} />
        <Stat label="Conversion rate (mo.)" value={formatPercent(d.conversionRate)} />
        <Stat label="Crew utilization (wk.)" value={formatPercent(d.crewUtilization)} />
        <Stat label="New leads (7d)" value={String(d.newLeadsCount)} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Needs attention</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AttentionCard
            icon={Inbox}
            count={d.leadsAwaitingResponse}
            label="new leads need responses"
            href="/leads"
          />
          <AttentionCard
            icon={AlertTriangle}
            count={d.estimatesAwaitingFollowUp}
            label="estimates need follow-up"
            href="/estimates/recovery"
          />
          <AttentionCard
            icon={FileWarning}
            count={d.overdueInvoicesCount}
            label="invoices are overdue"
            href="/invoices"
          />
          <AttentionCard
            icon={Camera}
            count={d.jobsMissingAfterPhotos}
            label="jobs missing completion photos"
            href="/jobs"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Money sitting on the table</h2>
        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <MoneyStat label="Open estimates" value={d.openEstimateValue} sub={`${d.openEstimateCount} estimates`} />
            <MoneyStat label="Needs follow-up" value={d.needsFollowUpValue} />
            <MoneyStat label="No response 3+ days" value={d.noResponse3Value} />
            <MoneyStat label="No response 7+ days" value={d.noResponse7Value} />
            <MoneyStat label="Recovered this month" value={d.recoveredValue} positive />
          </CardContent>
        </Card>
        <Link href="/estimates/recovery" className="mt-2 inline-block text-sm underline">
          Open the Estimate Recovery Center →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function AttentionCard({
  icon: Icon,
  count,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  label: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className={count > 0 ? "border-amber-300 bg-amber-50" : ""}>
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className={`h-5 w-5 ${count > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
          <div>
            <div className="text-lg font-semibold">{count}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MoneyStat({ label, value, sub, positive }: { label: string; value: number; sub?: string; positive?: boolean }) {
  return (
    <div>
      <div className={`text-xl font-semibold ${positive ? "text-green-600" : ""}`}>{formatCurrency(value)}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
