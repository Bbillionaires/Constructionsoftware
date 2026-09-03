"use client";

import { useTransition } from "react";
import { updateJobStatusAction } from "@/lib/actions/jobs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { JobStatus } from "@prisma/client";

const STATUSES: JobStatus[] = [
  "SCHEDULED",
  "DISPATCHED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "INVOICED",
  "CLOSED",
  "CANCELLED",
];

export function JobStatusSelect({ jobId, status }: { jobId: string; status: JobStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      onValueChange={(value) => {
        if (!value) return;
        startTransition(() => updateJobStatusAction(jobId, value as JobStatus));
      }}
    >
      <SelectTrigger className="w-44" disabled={pending}>
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
