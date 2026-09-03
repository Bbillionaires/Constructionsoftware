import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPercent } from "@/lib/money";
import { JobStatusSelect } from "./job-status-select";
import { ScheduleDialog } from "../schedule-dialog";
import { addJobPhotoAction, deleteJobPhotoAction } from "@/lib/actions/job-photos";
import { addJobMaterialAction, deleteJobMaterialAction } from "@/lib/actions/job-materials";
import { completeJobAndRedirect } from "@/lib/actions/job-complete";
import { CheckCircle2, Trash2 } from "lucide-react";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      property: true,
      estimate: true,
      assignments: { include: { user: true } },
      photos: { orderBy: { takenAt: "desc" } },
      jobMaterials: { orderBy: { createdAt: "desc" } },
      timeEntries: { include: { technician: true }, orderBy: { clockIn: "desc" } },
      jobCost: true,
      invoice: true,
      services: true,
    },
  });
  if (!job) notFound();

  const technicians = await prisma.technician.findMany({
    where: { companyId: session.companyId, isActive: true },
    include: { user: true },
  });

  const addPhoto = addJobPhotoAction.bind(null, job.id);
  const addMaterial = addJobMaterialAction.bind(null, job.id);
  const estimatedMaterial = Number(job.quotedMaterialCost);
  const actualMaterial = job.jobMaterials
    .filter((m) => m.source === "ACTUAL")
    .reduce((sum, m) => sum + Number(m.totalCost), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            JOB-{job.number} · {job.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {job.customer.firstName} {job.customer.lastName} · {job.property.addressLine1}, {job.property.city}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <JobStatusSelect jobId={job.id} status={job.status} />
          <ScheduleDialog
            key={`${job.updatedAt.getTime()}-${job.assignments.map((a) => a.userId).join(",")}`}
            jobId={job.id}
            technicians={technicians.map((t) => ({ id: t.userId, name: t.user.name }))}
            defaultTechnicianIds={job.assignments.map((a) => a.userId)}
            defaultDate={job.scheduledStart?.toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xl font-semibold">{formatCurrency(job.quotedTotal)}</div>
            <div className="text-sm text-muted-foreground">Quoted total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xl font-semibold">
              {job.scheduledStart
                ? job.scheduledStart.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                : "Unscheduled"}
            </div>
            <div className="text-sm text-muted-foreground">Scheduled</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xl font-semibold">{job.assignments.map((a) => a.user.name).join(", ") || "—"}</div>
            <div className="text-sm text-muted-foreground">Technicians</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {job.estimate ? (
              <Link href={`/estimates/${job.estimate.id}`} className="text-sm underline">
                View estimate EST-{job.estimate.number}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">No linked estimate</span>
            )}
          </CardContent>
        </Card>
      </div>

      {job.status !== "COMPLETED" && job.status !== "INVOICED" && job.status !== "CLOSED" && (
        <form action={completeJobAndRedirect.bind(null, job.id)}>
          <Button type="submit" variant="secondary">
            <CheckCircle2 className="mr-1 h-4 w-4" /> Mark job complete &amp; generate invoice
          </Button>
        </form>
      )}
      {job.invoice && (
        <Link href={`/invoices/${job.invoice.id}`}>
          <Badge variant="outline">Invoice INV-{job.invoice.number} · {job.invoice.status}</Badge>
        </Link>
      )}

      <Tabs defaultValue="photos">
        <TabsList>
          <TabsTrigger value="photos">Photos ({job.photos.length})</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="costing">Profitability</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="space-y-3">
          <form action={addPhoto} className="flex flex-wrap items-center gap-2">
            <input type="file" name="file" accept="image/*" required className="text-sm" />
            <select name="phase" className="rounded-md border px-2 py-1 text-sm" defaultValue="DURING">
              <option value="BEFORE">Before</option>
              <option value="DURING">During</option>
              <option value="AFTER">After</option>
            </select>
            <Input name="caption" placeholder="Caption (optional)" className="w-48" />
            <Button type="submit" size="sm">
              Upload
            </Button>
          </form>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {job.photos.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-md border">
                <Image src={p.url} alt={p.caption ?? p.phase} width={200} height={200} className="h-32 w-full object-cover" />
                <Badge className="absolute left-1 top-1 text-[10px]">{p.phase}</Badge>
                <form action={deleteJobPhotoAction.bind(null, p.id, job.id)} className="absolute right-1 top-1 opacity-0 group-hover:opacity-100">
                  <button type="submit" className="rounded bg-background/80 p-1">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </form>
              </div>
            ))}
            {job.photos.length === 0 && <p className="text-sm text-muted-foreground">No photos yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="materials" className="space-y-3">
          <form action={addMaterial} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Input name="description" required className="w-48" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Qty</label>
              <Input name="quantity" type="number" step="0.01" defaultValue="1" className="w-20" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Unit cost</label>
              <Input name="unitCost" type="number" step="0.01" defaultValue="0" className="w-24" />
            </div>
            <select name="source" className="rounded-md border px-2 py-2 text-sm" defaultValue="ACTUAL">
              <option value="ACTUAL">Actual</option>
              <option value="ESTIMATED">Estimated</option>
            </select>
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>

          <div className="rounded-md border">
            {job.jobMaterials.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b p-2 text-sm last:border-0">
                <span>
                  {m.description} <Badge variant="outline" className="ml-1 text-[10px]">{m.source}</Badge>
                </span>
                <span className="flex items-center gap-3">
                  {m.quantity.toString()} × {formatCurrency(m.unitCost)} = {formatCurrency(m.totalCost)}
                  <form action={deleteJobMaterialAction.bind(null, m.id, job.id)}>
                    <button type="submit" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </form>
                </span>
              </div>
            ))}
            {job.jobMaterials.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">No materials logged yet.</p>
            )}
          </div>

          <div className="flex gap-6 text-sm">
            <span>Estimated: {formatCurrency(estimatedMaterial)}</span>
            <span>Actual: {formatCurrency(actualMaterial)}</span>
            <span className={actualMaterial > estimatedMaterial ? "text-destructive" : "text-green-600"}>
              Variance: {formatCurrency(actualMaterial - estimatedMaterial)}
            </span>
          </div>
        </TabsContent>

        <TabsContent value="time" className="space-y-2">
          {job.timeEntries.map((t) => {
            const hours = t.clockOut ? (t.clockOut.getTime() - t.clockIn.getTime()) / 3600000 : null;
            return (
              <div key={t.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{t.technician.name}</span>
                <span>{t.clockIn.toLocaleString()}</span>
                <span>{hours != null ? `${hours.toFixed(2)}h` : "In progress"}</span>
              </div>
            );
          })}
          {job.timeEntries.length === 0 && <p className="text-sm text-muted-foreground">No time logged yet.</p>}
        </TabsContent>

        <TabsContent value="costing" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quoted vs. actual</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Metric label="Quoted margin" value={formatPercent(job.quotedGrossMarginPercent)} />
              <Metric
                label="Actual margin"
                value={job.jobCost ? formatPercent(job.jobCost.actualGrossMarginPercent) : "—"}
              />
              <Metric
                label="Margin variance"
                value={
                  job.jobCost
                    ? formatPercent(Number(job.jobCost.actualGrossMarginPercent) - Number(job.quotedGrossMarginPercent))
                    : "—"
                }
              />
              <Metric label="Quoted labor hours" value={job.services.length ? "see services" : "—"} />
              <Metric label="Actual labor hours" value={job.jobCost ? job.jobCost.laborHoursActual.toString() : "—"} />
              <Metric label="Actual labor cost" value={job.jobCost ? formatCurrency(job.jobCost.actualLaborCost) : "—"} />
            </CardContent>
          </Card>
          {!job.jobCost && (
            <p className="text-sm text-muted-foreground">
              Profitability is calculated automatically once the job is marked complete.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
