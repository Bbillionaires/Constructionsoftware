import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/money";
import { addCommunicationAction } from "@/lib/actions/customers";
import { LeadStatusSelect } from "./lead-status-select";
import { MarkLostForm } from "./mark-lost-form";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      property: true,
      assignedTo: true,
      communications: { orderBy: { createdAt: "desc" } },
      estimates: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) notFound();

  async function addNote(formData: FormData) {
    "use server";
    await addCommunicationAction(lead!.customerId, formData, { leadId: lead!.id });
  }

  const responseMinutes = lead.firstResponseAt
    ? Math.round((lead.firstResponseAt.getTime() - lead.receivedAt.getTime()) / 60000)
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {lead.customer.firstName} {lead.customer.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">{lead.requestedService}</p>
          </div>
          <LeadStatusSelect leadId={lead.id} status={lead.status} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Phone</div>
              <div>{lead.customer.phone || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Email</div>
              <div>{lead.customer.email || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Property</div>
              <div>
                {lead.property
                  ? `${lead.property.addressLine1}, ${lead.property.city}, ${lead.property.state}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Source</div>
              <div>{lead.source.replace(/_/g, " ")}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated value</div>
              <div>{lead.estimatedValue ? formatCurrency(lead.estimatedValue) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Response time</div>
              <div>{responseMinutes != null ? `${responseMinutes} min` : "Awaiting response"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Assigned to</div>
              <div>{lead.assignedTo?.name || "Unassigned"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Received</div>
              <div>{lead.receivedAt.toLocaleString()}</div>
            </div>
            {lead.description && (
              <div className="col-span-2">
                <div className="text-muted-foreground">Notes</div>
                <div>{lead.description}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Communication history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={addNote} className="flex gap-2">
              <Input name="body" placeholder="Log a call or note…" className="flex-1" />
              <input type="hidden" name="channel" value="MANUAL_NOTE" />
              <Button type="submit">Log</Button>
            </form>
            <div className="space-y-2">
              {lead.communications.map((c) => (
                <div key={c.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{c.channel.replace(/_/g, " ")}</Badge>
                    <span>{c.direction}</span>
                    <span>{c.createdAt.toLocaleString()}</span>
                  </div>
                  {c.body && <p className="mt-1">{c.body}</p>}
                </div>
              ))}
              {lead.communications.length === 0 && (
                <p className="text-sm text-muted-foreground">No communication logged yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next step</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button render={<Link href={`/estimates/new?leadId=${lead.id}`} />} nativeButton={false} className="w-full">
              Build estimate
            </Button>
            <MarkLostForm leadId={lead.id} disabled={lead.status === "LOST"} />
          </CardContent>
        </Card>

        {lead.estimates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estimates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lead.estimates.map((e) => (
                <Link key={e.id} href={`/estimates/${e.id}`} className="block text-sm hover:underline">
                  EST-{e.number} · {e.status.replace(/_/g, " ")}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
