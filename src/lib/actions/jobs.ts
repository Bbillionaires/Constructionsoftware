"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, OFFICE_ROLES } from "@/lib/session";
import type { JobStatus } from "@prisma/client";

export async function scheduleJobAction(jobId: string, formData: FormData) {
  const session = await requireSession();
  assertRole(session, OFFICE_ROLES);

  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "09:00");
  const durationHours = parseFloat(String(formData.get("durationHours") ?? "2"));
  const technicianIds = formData.getAll("technicianIds").map(String).filter(Boolean);

  if (!date) throw new Error("Pick a date.");

  const scheduledStart = new Date(`${date}T${startTime}:00`);
  const scheduledEnd = new Date(scheduledStart.getTime() + durationHours * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    const job = await tx.job.update({
      where: { id: jobId, companyId: session.companyId },
      data: { scheduledStart, scheduledEnd, status: "SCHEDULED" },
    });

    await tx.jobAssignment.deleteMany({ where: { jobId: job.id } });
    if (technicianIds.length > 0) {
      await tx.jobAssignment.createMany({
        data: technicianIds.map((userId) => ({ jobId: job.id, userId, role: "TECHNICIAN" as const })),
      });
    }

    if (job.estimateId) {
      const estimate = await tx.estimate.findUnique({ where: { id: job.estimateId } });
      if (estimate?.leadId) {
        await tx.lead.update({ where: { id: estimate.leadId }, data: { status: "JOB_SCHEDULED" } });
      }
    }
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
}

export async function updateJobStatusAction(jobId: string, status: JobStatus) {
  const session = await requireSession();
  assertRole(session, OFFICE_ROLES);

  const data: { status: JobStatus; actualStart?: Date; actualEnd?: Date } = { status };
  if (status === "IN_PROGRESS") data.actualStart = new Date();
  if (status === "COMPLETED") data.actualEnd = new Date();

  await prisma.job.update({ where: { id: jobId, companyId: session.companyId }, data });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
}
