"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, ESTIMATOR_ROLES, MANAGER_ROLES } from "@/lib/session";

function parseAmount(raw: FormDataEntryValue | null): number {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function createChangeOrderAction(jobId: string, formData: FormData) {
  const session = await requireSession();
  assertRole(session, ESTIMATOR_ROLES);

  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("A description of the change is required.");

  const laborAmount = parseAmount(formData.get("laborAmount"));
  const materialAmount = parseAmount(formData.get("materialAmount"));
  const totalAmount = Math.round((laborAmount + materialAmount) * 100) / 100;

  const job = await prisma.job.findFirstOrThrow({ where: { id: jobId, companyId: session.companyId } });

  await prisma.changeOrder.create({
    data: {
      companyId: session.companyId,
      jobId: job.id,
      description,
      laborAmount,
      materialAmount,
      totalAmount,
      createdById: session.userId,
      sentAt: new Date(),
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function voidChangeOrderAction(changeOrderId: string, jobId: string) {
  const session = await requireSession();
  assertRole(session, ESTIMATOR_ROLES);

  const changeOrder = await prisma.changeOrder.findFirstOrThrow({
    where: { id: changeOrderId, companyId: session.companyId },
  });
  if (changeOrder.status !== "PENDING") {
    throw new Error("Only a pending change order can be voided — it's already been responded to.");
  }

  await prisma.changeOrder.delete({ where: { id: changeOrderId } });
  revalidatePath(`/jobs/${jobId}`);
}

/**
 * Manual override for when the customer approved or declined outside the
 * digital flow (verbally, over the phone, or on a paper form) — records the
 * outcome without a captured signature.
 */
export async function markChangeOrderStatusAction(
  changeOrderId: string,
  jobId: string,
  status: "APPROVED" | "DECLINED"
) {
  const session = await requireSession();
  assertRole(session, MANAGER_ROLES);

  const changeOrder = await prisma.changeOrder.findFirstOrThrow({
    where: { id: changeOrderId, companyId: session.companyId },
  });
  if (changeOrder.status !== "PENDING") {
    throw new Error("This change order has already been responded to.");
  }

  await prisma.changeOrder.update({
    where: { id: changeOrderId },
    data: { status, respondedAt: new Date(), approvedAt: status === "APPROVED" ? new Date() : null },
  });

  revalidatePath(`/jobs/${jobId}`);
}

async function getChangeOrderByToken(token: string) {
  return prisma.changeOrder.findUniqueOrThrow({
    where: { publicToken: token },
    include: { job: { include: { customer: true, property: true } }, company: true },
  });
}

export async function approveChangeOrderPortalAction(
  token: string,
  payload: { signerName: string; signatureDataUrl: string }
) {
  const changeOrder = await getChangeOrderByToken(token);
  if (changeOrder.status !== "PENDING") return;

  await prisma.$transaction(async (tx) => {
    await tx.signature.create({
      data: {
        companyId: changeOrder.companyId,
        changeOrderId: changeOrder.id,
        signerName: payload.signerName,
        imageDataUrl: payload.signatureDataUrl,
      },
    });
    await tx.changeOrder.update({
      where: { id: changeOrder.id },
      data: { status: "APPROVED", respondedAt: new Date(), approvedAt: new Date() },
    });
  });

  revalidatePath(`/jobs/${changeOrder.jobId}`);
}

export async function declineChangeOrderPortalAction(token: string) {
  const changeOrder = await getChangeOrderByToken(token);
  if (changeOrder.status !== "PENDING") return;

  await prisma.changeOrder.update({
    where: { id: changeOrder.id },
    data: { status: "DECLINED", respondedAt: new Date() },
  });

  revalidatePath(`/jobs/${changeOrder.jobId}`);
}
