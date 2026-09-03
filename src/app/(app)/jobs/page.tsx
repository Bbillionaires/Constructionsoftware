import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/money";
import { ScheduleDialog } from "./schedule-dialog";

export default async function JobsPage() {
  const session = await requireSession();

  const [jobs, technicians] = await Promise.all([
    prisma.job.findMany({
      where: { companyId: session.companyId },
      include: { customer: true, property: true, assignments: { include: { user: true } } },
      orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.technician.findMany({ where: { companyId: session.companyId, isActive: true }, include: { user: true } }),
  ]);

  const techOptions = technicians.map((t) => ({ id: t.userId, name: t.user.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-muted-foreground">Every job from scheduling through completion.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Technicians</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    <Link href={`/jobs/${j.id}`} className="hover:underline">
                      JOB-{j.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {j.customer.firstName} {j.customer.lastName}
                    <div className="text-xs text-muted-foreground">{j.property.addressLine1}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {j.scheduledStart
                      ? j.scheduledStart.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Unscheduled"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {j.assignments.map((a) => a.user.name).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{j.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(j.quotedTotal)}</TableCell>
                  <TableCell>
                    <ScheduleDialog
                      key={`${j.updatedAt.getTime()}-${j.assignments.map((a) => a.userId).join(",")}`}
                      jobId={j.id}
                      technicians={techOptions}
                      defaultTechnicianIds={j.assignments.map((a) => a.userId)}
                      defaultDate={j.scheduledStart?.toISOString().slice(0, 10)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No jobs yet — approve an estimate to create one.
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
