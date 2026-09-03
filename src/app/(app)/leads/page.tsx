import { prisma } from "@/lib/prisma";
import { requireSession, OFFICE_ROLES } from "@/lib/session";
import { KanbanBoard } from "./kanban-board";
import { NewLeadDialog } from "./new-lead-dialog";
import { Card, CardContent } from "@/components/ui/card";

export default async function LeadsPage() {
  const session = await requireSession();

  const [leads, customers, staff] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId: session.companyId, status: { not: "COMPLETED" } },
      include: { customer: { select: { firstName: true, lastName: true } } },
      orderBy: { receivedAt: "desc" },
      take: 300,
    }),
    prisma.customer.findMany({
      where: { companyId: session.companyId },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.companyMember.findMany({
      where: { companyId: session.companyId, role: { in: OFFICE_ROLES } },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const newLeads = leads.filter((l) => l.status === "NEW");
  const respondedLeads = leads.filter((l) => l.firstResponseAt);
  const avgResponseMinutes =
    respondedLeads.length > 0
      ? Math.round(
          respondedLeads.reduce(
            (sum, l) => sum + (l.firstResponseAt!.getTime() - l.receivedAt.getTime()) / 60000,
            0
          ) / respondedLeads.length
        )
      : null;

  const kanbanLeads = leads.map((l) => ({
    id: l.id,
    requestedService: l.requestedService,
    status: l.status,
    estimatedValue: l.estimatedValue?.toString() ?? null,
    source: l.source,
    receivedAt: l.receivedAt.toISOString(),
    customer: l.customer,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">Drag a card to move it through your pipeline.</p>
        </div>
        <NewLeadDialog
          customers={customers}
          staff={staff.map((m) => ({ id: m.user.id, name: m.user.name }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">{newLeads.length}</div>
            <div className="text-sm text-muted-foreground">New leads awaiting response</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">
              {avgResponseMinutes != null ? `${avgResponseMinutes}m` : "—"}
            </div>
            <div className="text-sm text-muted-foreground">Average response time</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">{leads.length}</div>
            <div className="text-sm text-muted-foreground">Active pipeline</div>
          </CardContent>
        </Card>
      </div>

      <KanbanBoard leads={kanbanLeads} />
    </div>
  );
}
