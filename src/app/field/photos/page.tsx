import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";

export default async function FieldPhotosPage() {
  const session = await requireSession();

  const photos = await prisma.jobPhoto.findMany({
    where: { companyId: session.companyId, job: { assignments: { some: { userId: session.userId } } } },
    include: { job: { include: { customer: true } } },
    orderBy: { takenAt: "desc" },
    take: 60,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Photos</h1>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <Link key={p.id} href={`/field/jobs/${p.jobId}`} className="relative">
            <Image src={p.url} alt={p.phase} width={120} height={120} className="h-24 w-full rounded object-cover" />
            <Badge className="absolute left-1 top-1 text-[9px]">{p.phase}</Badge>
          </Link>
        ))}
        {photos.length === 0 && (
          <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">No photos yet.</p>
        )}
      </div>
    </div>
  );
}
