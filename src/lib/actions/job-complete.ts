"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { computeJobCost } from "@/lib/job-costing";
import { generateInvoiceForJob } from "@/lib/invoice-generation";

export async function completeJobAction(jobId: string) {
  const session = await requireSession();

  await prisma.job.update({
    where: { id: jobId, companyId: session.companyId },
    data: { status: "COMPLETED", actualEnd: new Date() },
  });

  await prisma.timeEntry.updateMany({
    where: { jobId, clockOut: null },
    data: { clockOut: new Date() },
  });

  await computeJobCost(jobId);
  const invoiceId = await generateInvoiceForJob(jobId);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/field/jobs/${jobId}`);
  revalidatePath("/invoices");
  revalidatePath("/field/today");

  return invoiceId;
}

export async function completeJobAndRedirect(jobId: string) {
  const invoiceId = await completeJobAction(jobId);
  redirect(`/invoices/${invoiceId}`);
}

export async function completeJobFromFieldAction(jobId: string) {
  await completeJobAction(jobId);
  redirect(`/field/jobs/${jobId}`);
}
