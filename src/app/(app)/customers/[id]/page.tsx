import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addPropertyAction, addCommunicationAction } from "@/lib/actions/customers";
import { formatCurrency } from "@/lib/money";
import { getEstimateTotalDollars } from "@/lib/estimate-totals";
import { Plus, MapPin } from "lucide-react";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      properties: true,
      estimates: {
        include: { options: { include: { lineItems: true } }, property: true },
        orderBy: { createdAt: "desc" },
      },
      jobs: { include: { property: true, invoice: true }, orderBy: { createdAt: "desc" } },
      communications: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!customer) notFound();

  const addProperty = addPropertyAction.bind(null, customer.id);
  const addNote = addCommunicationAction.bind(null, customer.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {customer.firstName} {customer.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {customer.phone} {customer.email && `· ${customer.email}`}
        </p>
      </div>

      <Tabs defaultValue="properties">
        <TabsList>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="estimates">Estimates ({customer.estimates.length})</TabsTrigger>
          <TabsTrigger value="jobs">Jobs ({customer.jobs.length})</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-3">
          <Dialog>
            <DialogTrigger render={<Button size="sm" variant="outline" />}>
              <Plus className="mr-1 h-4 w-4" /> Add property
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add property</DialogTitle>
              </DialogHeader>
              <form action={addProperty} className="space-y-3">
                <Input name="addressLine1" placeholder="Address" required />
                <div className="grid grid-cols-3 gap-3">
                  <Input name="city" placeholder="City" required />
                  <Input name="state" placeholder="State" required />
                  <Input name="postalCode" placeholder="ZIP" required />
                </div>
                <Textarea name="accessNotes" placeholder="Access notes (gate code, pets, parking...)" />
                <Button type="submit" className="w-full">
                  Save property
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {customer.properties.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{p.addressLine1}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.city}, {p.state} {p.postalCode}
                  </div>
                  {p.accessNotes && <div className="mt-1 text-sm">{p.accessNotes}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
          {customer.properties.length === 0 && (
            <p className="text-sm text-muted-foreground">No properties on file yet.</p>
          )}
        </TabsContent>

        <TabsContent value="estimates" className="space-y-3">
          {customer.estimates.map((e) => (
            <Link key={e.id} href={`/estimates/${e.id}`}>
              <Card className="hover:bg-muted/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">
                      EST-{e.number} · {e.title}
                    </div>
                    <div className="text-sm text-muted-foreground">{e.property.addressLine1}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCurrency(getEstimateTotalDollars(e))}</span>
                    <Badge variant="outline">{e.status.replace(/_/g, " ")}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {customer.estimates.length === 0 && (
            <p className="text-sm text-muted-foreground">No estimates yet.</p>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-3">
          {customer.jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`}>
              <Card className="hover:bg-muted/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">
                      JOB-{j.number} · {j.title}
                    </div>
                    <div className="text-sm text-muted-foreground">{j.property.addressLine1}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCurrency(j.quotedTotal)}</span>
                    <Badge variant="outline">{j.status.replace(/_/g, " ")}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {customer.jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs yet.</p>}
        </TabsContent>

        <TabsContent value="communications" className="space-y-3">
          <form action={addNote} className="flex gap-2">
            <Input name="body" placeholder="Log a note or call…" className="flex-1" />
            <input type="hidden" name="channel" value="MANUAL_NOTE" />
            <Button type="submit">Log</Button>
          </form>
          <div className="space-y-2">
            {customer.communications.map((c) => (
              <div key={c.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{c.channel.replace(/_/g, " ")}</Badge>
                  <span>{c.direction}</span>
                  <span>{c.createdAt.toLocaleString()}</span>
                </div>
                {c.body && <p className="mt-1">{c.body}</p>}
              </div>
            ))}
            {customer.communications.length === 0 && (
              <p className="text-sm text-muted-foreground">No communications logged yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
