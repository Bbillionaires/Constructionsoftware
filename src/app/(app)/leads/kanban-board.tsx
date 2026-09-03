"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateLeadStatusAction } from "@/lib/actions/leads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/money";
import type { LeadStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const COLUMNS: { status: LeadStatus; label: string }[] = [
  { status: "NEW", label: "New" },
  { status: "CONTACTED", label: "Contacted" },
  { status: "QUALIFIED", label: "Qualified" },
  { status: "ESTIMATE_SCHEDULED", label: "Estimate Scheduled" },
  { status: "ESTIMATE_SENT", label: "Estimate Sent" },
  { status: "FOLLOW_UP", label: "Follow-Up" },
  { status: "APPROVED", label: "Approved" },
  { status: "JOB_SCHEDULED", label: "Job Scheduled" },
  { status: "COMPLETED", label: "Completed" },
  { status: "LOST", label: "Lost" },
];

export type KanbanLead = {
  id: string;
  requestedService: string;
  status: LeadStatus;
  estimatedValue: string | null;
  source: string;
  receivedAt: string;
  customer: { firstName: string; lastName: string };
};

export function KanbanBoard({ leads }: { leads: KanbanLead[] }) {
  const [items, setItems] = useState(leads);
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);

  function onDrop(status: LeadStatus) {
    if (!dragId) return;
    setItems((prev) => prev.map((l) => (l.id === dragId ? { ...l, status } : l)));
    startTransition(() => {
      updateLeadStatusAction(dragId, status);
    });
    setDragId(null);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colLeads = items.filter((l) => l.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(col.status)}
            className="w-64 shrink-0 rounded-lg bg-muted/40 p-2"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">{col.label}</span>
              <Badge variant="secondary">{colLeads.length}</Badge>
            </div>
            <div className="space-y-2">
              {colLeads.map((lead) => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  className={cn("cursor-grab active:cursor-grabbing", dragId === lead.id && "opacity-50")}
                >
                  <CardContent className="space-y-1 p-3">
                    <Link href={`/leads/${lead.id}`} className="block text-sm font-medium hover:underline">
                      {lead.customer.firstName} {lead.customer.lastName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{lead.requestedService}</div>
                    <div className="flex items-center justify-between pt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {lead.source.replace(/_/g, " ")}
                      </Badge>
                      {lead.estimatedValue && (
                        <span className="text-xs font-medium">{formatCurrency(lead.estimatedValue)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
