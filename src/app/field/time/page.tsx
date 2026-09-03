import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { ClockControl } from "../jobs/[id]/clock-control";

export default async function FieldTimePage() {
  const session = await requireSession();

  const entries = await prisma.timeEntry.findMany({
    where: { companyId: session.companyId, technicianId: session.userId },
    include: { job: { include: { customer: true } } },
    orderBy: { clockIn: "desc" },
    take: 30,
  });

  const openEntry = entries.find((e) => !e.clockOut);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Time</h1>

      {openEntry && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm">
              Clocked in on <strong>{openEntry.job.title}</strong> since{" "}
              {openEntry.clockIn.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </p>
            <ClockControl jobId={openEntry.jobId} openEntryId={openEntry.id} />
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {entries.map((e) => {
          const hours = e.clockOut ? (e.clockOut.getTime() - e.clockIn.getTime()) / 3600000 : null;
          return (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">{e.job.title}</div>
                  <div className="text-muted-foreground">{e.clockIn.toLocaleDateString()}</div>
                </div>
                <div>{hours != null ? `${hours.toFixed(2)}h` : "In progress"}</div>
              </CardContent>
            </Card>
          );
        })}
        {entries.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No time logged yet.</p>}
      </div>
    </div>
  );
}
