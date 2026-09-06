import { requireSession } from "@/lib/session";
import {
  getRevenueByMonth,
  getLeadSourceReport,
  getServiceProfitabilityReport,
  getTechnicianProductivityReport,
  getVarianceReport,
} from "@/lib/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/money";

export default async function ReportsPage() {
  const session = await requireSession();

  const [revenue, leadSources, services, technicians, variance] = await Promise.all([
    getRevenueByMonth(session.companyId),
    getLeadSourceReport(session.companyId),
    getServiceProfitabilityReport(session.companyId),
    getTechnicianProductivityReport(session.companyId),
    getVarianceReport(session.companyId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">How the business is actually performing.</p>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="leads">Lead Sources</TabsTrigger>
          <TabsTrigger value="services">Service Profitability</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
          <TabsTrigger value="variance">Labor &amp; Material Variance</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cash collected by month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-2">
                {revenue.map((r) => (
                  <div key={r.label} className="text-center">
                    <div
                      className="mx-auto w-8 rounded bg-primary"
                      style={{
                        height: `${Math.max(8, (r.total / Math.max(...revenue.map((x) => x.total), 1)) * 120)}px`,
                      }}
                    />
                    <div className="mt-1 text-xs text-muted-foreground">{r.label}</div>
                    <div className="text-xs font-medium">{formatCurrency(r.total)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Won</TableHead>
                    <TableHead>Conversion</TableHead>
                    <TableHead>Pipeline value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadSources.map((r) => (
                    <TableRow key={r.source}>
                      <TableCell>{r.source.replace(/_/g, " ")}</TableCell>
                      <TableCell>{r.total}</TableCell>
                      <TableCell>{r.won}</TableCell>
                      <TableCell>{formatPercent(r.conversionRate)}</TableCell>
                      <TableCell>{formatCurrency(r.value)}</TableCell>
                    </TableRow>
                  ))}
                  {leadSources.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No leads yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Gross profit</TableHead>
                    <TableHead>Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.key}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.jobCount}</TableCell>
                      <TableCell>{formatCurrency(s.revenue)}</TableCell>
                      <TableCell>{formatCurrency(s.grossProfit)}</TableCell>
                      <TableCell>{formatPercent(s.marginPercent)}</TableCell>
                    </TableRow>
                  ))}
                  {services.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No completed jobs yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technicians">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Jobs completed</TableHead>
                    <TableHead>Hours logged</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Revenue / hour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicians.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.jobsCompleted}</TableCell>
                      <TableCell>{t.hours.toFixed(1)}</TableCell>
                      <TableCell>{formatCurrency(t.revenue)}</TableCell>
                      <TableCell>{t.hours >= 0.1 ? formatCurrency(t.revenuePerHour) : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {technicians.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No technicians yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estimated vs. actual, across {variance.jobCount} completed jobs</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Metric label="Labor hours estimated" value={variance.laborHoursEstimated.toFixed(1)} />
              <Metric label="Labor hours actual" value={variance.laborHoursActual.toFixed(1)} />
              <Metric
                label="Labor hours variance"
                value={variance.laborHoursVariance.toFixed(1)}
                warn={variance.laborHoursVariance > 0}
              />
              <Metric label="Material cost estimated" value={formatCurrency(variance.materialCostEstimated)} />
              <Metric label="Material cost actual" value={formatCurrency(variance.materialCostActual)} />
              <Metric
                label="Material cost variance"
                value={formatCurrency(variance.materialCostVariance)}
                warn={variance.materialCostVariance > 0}
              />
              <Metric label="Average actual margin" value={formatPercent(variance.averageActualMargin)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className={`text-lg font-semibold ${warn ? "text-destructive" : ""}`}>{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
