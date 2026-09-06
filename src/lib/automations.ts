import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/adapters/sms";
import { getEmailProvider } from "@/lib/adapters/email";
import type { AutomationTrigger } from "@prisma/client";

/**
 * Phase 1 automation engine: intentionally simple. Automations with
 * waitHours = 0 run synchronously at the call site (right after the
 * triggering action). Automations with a delay create a row with a future
 * scheduledAt that a "process due" sweep later picks up — see
 * processDueFollowUps / processDueReviewRequests, invoked by the Estimate
 * Recovery Center's "Run due follow-ups" action or an external cron hitting
 * /api/cron/run-automations. This is not a queue/worker system — for a
 * single-digit-employee contractor's traffic volume a pull-based sweep is
 * simpler to operate and just as reliable.
 */

const DEFAULT_MISSED_CALL_TEMPLATE =
  "Sorry we missed your call. This is {{company}}. What can we help you with today?";

function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/** Sends one notification email and logs it to the customer's communication history. */
export async function sendNotificationEmail(
  target: { companyId: string; customerId: string; jobId?: string },
  to: string,
  subject: string,
  html: string
) {
  const result = await getEmailProvider().send(to, subject, html);
  await prisma.communication.create({
    data: {
      companyId: target.companyId,
      customerId: target.customerId,
      jobId: target.jobId,
      channel: "EMAIL",
      direction: "OUTBOUND",
      status: result.ok ? "SENT" : "FAILED",
      body: html,
      toAddress: to,
    },
  });
  return result;
}

export async function runActiveAutomations(
  companyId: string,
  trigger: AutomationTrigger,
  vars: Record<string, string>,
  target: { customerId: string; leadId?: string; jobId?: string }
) {
  const automations = await prisma.automation.findMany({
    where: { companyId, trigger, isActive: true, waitHours: 0 },
  });

  const fallback =
    trigger === "MISSED_CALL" && automations.length === 0
      ? [{ id: "fallback", action: "SEND_SMS" as const, template: DEFAULT_MISSED_CALL_TEMPLATE }]
      : [];

  for (const automation of [...automations, ...fallback]) {
    const message = fillTemplate(automation.template, vars);

    if (automation.action === "SEND_SMS" && vars.phone) {
      const result = await getSmsProvider().send(vars.phone, message);
      await prisma.communication.create({
        data: {
          companyId,
          customerId: target.customerId,
          leadId: target.leadId,
          jobId: target.jobId,
          channel: "SMS",
          direction: "OUTBOUND",
          status: result.ok ? "SENT" : "FAILED",
          body: message,
          toAddress: vars.phone,
        },
      });
    } else if (automation.action === "SEND_EMAIL" && vars.email) {
      const result = await getEmailProvider().send(vars.email, `${vars.company} update`, message);
      await prisma.communication.create({
        data: {
          companyId,
          customerId: target.customerId,
          leadId: target.leadId,
          jobId: target.jobId,
          channel: "EMAIL",
          direction: "OUTBOUND",
          status: result.ok ? "SENT" : "FAILED",
          body: message,
          toAddress: vars.email,
        },
      });
    }

    if (target.leadId) {
      await prisma.lead.updateMany({
        where: { id: target.leadId, firstResponseAt: null },
        data: { firstResponseAt: new Date() },
      });
    }
  }
}

const FOLLOW_UP_SEQUENCE = [
  { step: 1, hours: 24, message: "Friendly reminder: your estimate from {{company}} is ready to review. {{link}}" },
  { step: 2, hours: 72, message: "Following up on your {{service}} estimate from {{company}} — happy to answer any questions. {{link}}" },
  { step: 3, hours: 168, message: "Final follow-up: your estimate from {{company}} will expire soon. {{link}}" },
];

export async function scheduleEstimateFollowUps(estimateId: string) {
  const now = Date.now();
  await prisma.estimateFollowUp.createMany({
    data: FOLLOW_UP_SEQUENCE.map((s) => ({
      estimateId,
      sequenceStep: s.step,
      scheduledAt: new Date(now + s.hours * 60 * 60 * 1000),
      channel: "SMS" as const,
      message: s.message,
      status: "PENDING" as const,
    })),
  });
}

export async function processDueFollowUps() {
  const due = await prisma.estimateFollowUp.findMany({
    where: { status: "PENDING", scheduledAt: { lte: new Date() } },
    include: {
      estimate: { include: { customer: true, property: true, company: true } },
    },
  });

  let sent = 0;
  for (const followUp of due) {
    const estimate = followUp.estimate;
    if (!["SENT", "VIEWED", "OPEN", "FOLLOW_UP_DUE"].includes(estimate.status)) {
      await prisma.estimateFollowUp.update({
        where: { id: followUp.id },
        data: { status: "SKIPPED" },
      });
      continue;
    }

    const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/portal/${estimate.publicToken}`;
    const message = fillTemplate(followUp.message, {
      company: estimate.company.name,
      service: estimate.title,
      link,
    });

    const to = estimate.customer.phone;
    if (to) {
      await getSmsProvider().send(to, message);
      await prisma.communication.create({
        data: {
          companyId: estimate.companyId,
          customerId: estimate.customerId,
          channel: "SMS",
          direction: "OUTBOUND",
          status: "SENT",
          body: message,
          toAddress: to,
        },
      });
    } else if (estimate.customer.email) {
      await sendNotificationEmail(
        { companyId: estimate.companyId, customerId: estimate.customerId },
        estimate.customer.email,
        `${estimate.company.name} update`,
        `<p>${message}</p>`
      );
    }

    await prisma.estimateFollowUp.update({
      where: { id: followUp.id },
      data: { status: "SENT", sentAt: new Date() },
    });

    if (estimate.status === "SENT" || estimate.status === "VIEWED") {
      await prisma.estimate.update({ where: { id: estimate.id }, data: { status: "FOLLOW_UP_DUE" } });
    }

    sent++;
  }
  return sent;
}

export async function scheduleReviewRequest(jobId: string, companyId: string) {
  const automation = await prisma.automation.findFirst({
    where: { companyId, trigger: "INVOICE_PAID", isActive: true },
  });
  const delayHours = automation?.waitHours ?? 24;
  await prisma.reviewRequest.upsert({
    where: { jobId },
    create: { companyId, jobId, delayHours, channel: "SMS", status: "PENDING" },
    update: {},
  });
}

export async function processDueReviewRequests() {
  const candidates = await prisma.reviewRequest.findMany({
    where: { status: "PENDING" },
    include: { job: { include: { customer: true, company: true } } },
  });

  let sent = 0;
  for (const rr of candidates) {
    const dueAt = new Date(rr.createdAt.getTime() + rr.delayHours * 60 * 60 * 1000);
    if (dueAt.getTime() > Date.now()) continue;

    const message = `Thanks for choosing ${rr.job.company.name}! Mind leaving us a quick review? ${
      process.env.NEXT_PUBLIC_APP_URL ?? ""
    }/review/${rr.id}`;
    const to = rr.job.customer.phone;
    if (to) {
      await getSmsProvider().send(to, message);
      await prisma.communication.create({
        data: {
          companyId: rr.companyId,
          customerId: rr.job.customerId,
          jobId: rr.jobId,
          channel: "SMS",
          direction: "OUTBOUND",
          status: "SENT",
          body: message,
          toAddress: to,
        },
      });
    } else if (rr.job.customer.email) {
      await sendNotificationEmail(
        { companyId: rr.companyId, customerId: rr.job.customerId, jobId: rr.jobId },
        rr.job.customer.email,
        `${rr.job.company.name} update`,
        `<p>${message}</p>`
      );
    }
    await prisma.reviewRequest.update({ where: { id: rr.id }, data: { status: "SENT", sentAt: new Date() } });
    sent++;
  }
  return sent;
}
