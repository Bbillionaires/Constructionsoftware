"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getStorageProvider } from "@/lib/adapters/storage";
import type { PhotoPhase } from "@prisma/client";

export async function addJobPhotoAction(jobId: string, formData: FormData) {
  const session = await requireSession();

  const file = formData.get("file") as File | null;
  const phase = String(formData.get("phase") ?? "DURING") as PhotoPhase;
  const caption = String(formData.get("caption") ?? "").trim() || null;

  if (!file || file.size === 0) throw new Error("Choose a photo to upload.");

  const job = await prisma.job.findFirstOrThrow({ where: { id: jobId, companyId: session.companyId } });

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await getStorageProvider().save(job.companyId, file.name || "photo.jpg", buffer, file.type);

  await prisma.jobPhoto.create({
    data: {
      companyId: job.companyId,
      jobId: job.id,
      url,
      phase,
      caption,
      takenById: session.userId,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/field/jobs/${jobId}`);
  revalidatePath("/field/photos");
}

export async function deleteJobPhotoAction(photoId: string, jobId: string) {
  const session = await requireSession();
  await prisma.jobPhoto.delete({ where: { id: photoId, companyId: session.companyId, jobId } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/field/jobs/${jobId}`);
}
