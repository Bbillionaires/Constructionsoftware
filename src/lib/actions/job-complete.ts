"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { computeJobCost } from "@/lib/job-costing";
import { generateInvoiceForJob } from "@/lib/invoice-generation";
import { sendNotificationEmail } from "@/lib/automations";
import { decToNum } from "@/lib/estimate-totals";

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

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { customer: true, company: true },
  });
  if (invoice.customer.email) {
    const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invoice-portal/${invoice.publicToken}`;
    await sendNotificationEmail(
      { companyId: invoice.companyId, customerId: invoice.customerId, jobId },
      invoice.customer.email,
      `Invoice INV-${invoice.number} from ${invoice.company.name}`,
      `<p>Hi ${invoice.customer.firstName},</p>
       <p>Your invoice from ${invoice.company.name} is ready — total due: $${decToNum(invoice.balanceDue).toFixed(2)}.</p>
       <p><a href="${link}">View invoice and pay online</a></p>`
    );
  }

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
