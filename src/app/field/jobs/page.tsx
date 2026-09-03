import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function FieldJobsPage() {
  const session = await requireSession();

  const jobs = await prisma.job.findMany({
    where: {
      companyId: session.companyId,
      assignments: { some: { userId: session.userId } },
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    include: { customer: true, property: true },
    orderBy: [{ scheduledStart: "asc" }],
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My jobs</h1>
      {jobs.map((j) => (
        <Link key={j.id} href={`/field/jobs/${j.id}`}>
          <Card className="active:bg-muted/60">
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {j.scheduledStart
                    ? j.scheduledStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : "Unscheduled"}
                </span>
                <Badge variant="outline">{j.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="font-medium">
                {j.customer.firstName} {j.customer.lastName}
              </div>
              <div className="text-sm text-muted-foreground">{j.property.addressLine1}</div>
            </CardContent>
          </Card>
        </Link>
      ))}
      {jobs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No jobs assigned.</p>}
    </div>
  );
}
