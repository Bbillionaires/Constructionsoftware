"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { MaterialSource } from "@prisma/client";

export async function addJobMaterialAction(jobId: string, formData: FormData) {
  const session = await requireSession();

  const description = String(formData.get("description") ?? "").trim();
  const quantity = parseFloat(String(formData.get("quantity") ?? "1")) || 1;
  const unitCost = parseFloat(String(formData.get("unitCost") ?? "0")) || 0;
  const source = String(formData.get("source") ?? "ACTUAL") as MaterialSource;

  if (!description) throw new Error("Describe the material.");

  const job = await prisma.job.findFirstOrThrow({ where: { id: jobId, companyId: session.companyId } });

  await prisma.jobMaterial.create({
    data: {
      jobId: job.id,
      description,
      quantity,
      unitCost,
      totalCost: Math.round(quantity * unitCost * 100) / 100,
      source,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/field/jobs/${jobId}`);
}

export async function deleteJobMaterialAction(materialId: string, jobId: string) {
  const session = await requireSession();
  await prisma.job.findFirstOrThrow({ where: { id: jobId, companyId: session.companyId } });
  await prisma.jobMaterial.delete({ where: { id: materialId, jobId } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/field/jobs/${jobId}`);
}
