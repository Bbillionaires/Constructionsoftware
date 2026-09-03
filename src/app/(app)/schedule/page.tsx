import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/money";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;
const WORKDAY_HOURS = 8;

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await requireSession();
  const { week } = await searchParams;

  const anchor = week ? new Date(week) : new Date();
  const weekStart = startOfWeek(anchor);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));

  const [jobs, technicians] = await Promise.all([
    prisma.job.findMany({
      where: {
        companyId: session.companyId,
        scheduledStart: { gte: weekStart, lt: weekEnd },
      },
      include: { customer: true, property: true, assignments: true },
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.technician.findMany({
      where: { companyId: session.companyId, isActive: true },
      include: { user: true },
    }),
  ]);

  const unassignedJobs = jobs.filter((j) => j.assignments.length === 0);

  const prevWeek = new Date(weekStart.getTime() - 7 * DAY_MS).toISOString().slice(0, 10);
  const nextWeek = new Date(weekStart.getTime() + 7 * DAY_MS).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Week of {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" render={<Link href={`/schedule?week=${prevWeek}`} />} nativeButton={false}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" render={<Link href={`/schedule?week=${nextWeek}`} />} nativeButton={false}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-2">
          <thead>
            <tr>
              <th className="w-40 text-left text-sm text-muted-foreground">Technician</th>
              {days.map((d) => (
                <th key={d.toISOString()} className="min-w-40 text-left text-sm text-muted-foreground">
                  {d.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {technicians.map((tech) => (
              <tr key={tech.id}>
                <td className="align-top text-sm font-medium">{tech.user.name}</td>
                {days.map((d) => {
                  const dayJobs = jobs.filter(
                    (j) =>
                      j.assignments.some((a) => a.userId === tech.userId) &&
                      j.scheduledStart &&
                      j.scheduledStart.toDateString() === d.toDateString()
                  );
                  const scheduledHours = dayJobs.reduce((sum, j) => {
                    if (!j.scheduledStart || !j.scheduledEnd) return sum;
                    return sum + (j.scheduledEnd.getTime() - j.scheduledStart.getTime()) / 3600000;
                  }, 0);
                  const available = Math.max(WORKDAY_HOURS - scheduledHours, 0);
                  return (
                    <td key={d.toISOString()} className="align-top">
                      <div className="space-y-1">
                        {dayJobs.map((j) => (
                          <Link key={j.id} href={`/jobs/${j.id}`}>
                            <Card className="hover:bg-muted/40">
                              <CardContent className="p-2 text-xs">
                                <div className="font-medium">
                                  {j.scheduledStart?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                                </div>
                                <div>{j.customer.firstName} {j.customer.lastName}</div>
                                <div className="text-muted-foreground">{j.title}</div>
                              </CardContent>
                            </Card>
                          </Link>
                        ))}
                        <div className="text-[10px] text-muted-foreground">
                          {available.toFixed(1)}h available
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {technicians.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-center text-sm text-muted-foreground">
                  Add technicians under Team to start scheduling.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {unassignedJobs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Unassigned this week</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {unassignedJobs.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`}>
                <Card className="hover:bg-muted/40">
                  <CardContent className="flex items-center justify-between p-3 text-sm">
                    <span>
                      {j.customer.firstName} {j.customer.lastName} · {j.title}
                    </span>
                    <Badge variant="outline">{formatCurrency(j.quotedTotal)}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
