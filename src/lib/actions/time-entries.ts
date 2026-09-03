"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function clockInAction(jobId: string) {
  const session = await requireSession();

  const job = await prisma.job.findFirstOrThrow({ where: { id: jobId, companyId: session.companyId } });

  const open = await prisma.timeEntry.findFirst({
    where: { jobId: job.id, technicianId: session.userId, clockOut: null },
  });
  if (open) return open.id;

  const entry = await prisma.timeEntry.create({
    data: { companyId: job.companyId, jobId: job.id, technicianId: session.userId, clockIn: new Date() },
  });

  if (job.status === "SCHEDULED" || job.status === "DISPATCHED") {
    await prisma.job.update({ where: { id: job.id }, data: { status: "IN_PROGRESS", actualStart: job.actualStart ?? new Date() } });
  }

  revalidatePath(`/field/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/field/time");
  return entry.id;
}

export async function clockOutAction(timeEntryId: string) {
  const session = await requireSession();

  const entry = await prisma.timeEntry.update({
    where: { id: timeEntryId, companyId: session.companyId },
    data: { clockOut: new Date() },
  });

  revalidatePath(`/field/jobs/${entry.jobId}`);
  revalidatePath(`/jobs/${entry.jobId}`);
  revalidatePath("/field/time");
}
