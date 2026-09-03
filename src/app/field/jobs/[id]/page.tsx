import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation, CheckCircle2 } from "lucide-react";
import { ClockControl } from "./clock-control";
import { addJobPhotoAction } from "@/lib/actions/job-photos";
import { addJobMaterialAction } from "@/lib/actions/job-materials";
import { completeJobFromFieldAction } from "@/lib/actions/job-complete";

export default async function FieldJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      property: true,
      services: { include: { priceBookItem: true } },
      photos: { orderBy: { takenAt: "desc" } },
      jobMaterials: true,
      timeEntries: { where: { technicianId: session.userId } },
    },
  });
  if (!job) notFound();

  const openEntry = job.timeEntries.find((t) => !t.clockOut);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${job.property.addressLine1}, ${job.property.city}, ${job.property.state} ${job.property.postalCode}`
  )}`;

  const addPhoto = addJobPhotoAction.bind(null, job.id);
  const addMaterial = addJobMaterialAction.bind(null, job.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{job.title}</h1>
        <p className="text-sm text-muted-foreground">
          {job.customer.firstName} {job.customer.lastName}
        </p>
        <Badge variant="outline" className="mt-1">
          {job.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="text-sm">{job.property.addressLine1}</div>
          <div className="text-sm text-muted-foreground">
            {job.property.city}, {job.property.state} {job.property.postalCode}
          </div>
          <Button variant="outline" className="w-full" render={<a href={mapsUrl} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <Navigation className="mr-1 h-4 w-4" /> Navigate
          </Button>
        </CardContent>
      </Card>

      <ClockControl jobId={job.id} openEntryId={openEntry?.id ?? null} />

      {job.services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {job.services.map((s) => (
              <div key={s.id}>{s.description}</div>
            ))}
            {job.notes && <p className="pt-2 text-muted-foreground">{job.notes}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={addPhoto} className="space-y-2">
            <input type="file" name="file" accept="image/*" capture="environment" required className="w-full text-sm" />
            <select name="phase" className="w-full rounded-md border px-2 py-2 text-sm" defaultValue="DURING">
              <option value="BEFORE">Before</option>
              <option value="DURING">During</option>
              <option value="AFTER">After</option>
            </select>
            <Button type="submit" className="w-full" size="sm">
              Upload photo
            </Button>
          </form>
          <div className="grid grid-cols-3 gap-2">
            {job.photos.map((p) => (
              <div key={p.id} className="relative">
                <Image src={p.url} alt={p.phase} width={100} height={100} className="h-20 w-full rounded object-cover" />
                <Badge className="absolute left-1 top-1 text-[9px]">{p.phase}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Materials used</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={addMaterial} className="space-y-2">
            <Input name="description" placeholder="Material description" required />
            <div className="grid grid-cols-2 gap-2">
              <Input name="quantity" type="number" step="0.01" placeholder="Qty" defaultValue="1" />
              <Input name="unitCost" type="number" step="0.01" placeholder="Unit cost" defaultValue="0" />
            </div>
            <input type="hidden" name="source" value="ACTUAL" />
            <Button type="submit" className="w-full" size="sm">
              Add material
            </Button>
          </form>
          <div className="space-y-1 text-sm">
            {job.jobMaterials.map((m) => (
              <div key={m.id} className="flex justify-between">
                <span>{m.description}</span>
                <span>{m.quantity.toString()}×</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {job.status !== "COMPLETED" && job.status !== "INVOICED" && job.status !== "CLOSED" && (
        <form action={completeJobFromFieldAction.bind(null, job.id)}>
          <Button type="submit" className="w-full" variant="secondary">
            <CheckCircle2 className="mr-1 h-4 w-4" /> Mark job complete
          </Button>
        </form>
      )}
    </div>
  );
}
