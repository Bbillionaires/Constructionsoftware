"use client";

import { useTransition } from "react";
import { updateLeadStatusAction } from "@/lib/actions/leads";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LeadStatus } from "@prisma/client";

const STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "ESTIMATE_SCHEDULED",
  "ESTIMATE_SENT",
  "FOLLOW_UP",
  "APPROVED",
  "JOB_SCHEDULED",
  "COMPLETED",
  "LOST",
];

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      onValueChange={(value) => {
        if (!value) return;
        startTransition(() => updateLeadStatusAction(leadId, value as LeadStatus));
      }}
    >
      <SelectTrigger className="w-48" disabled={pending}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
