"use client";

import { useState } from "react";
import { markLeadLostAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MarkLostForm({ leadId, disabled }: { leadId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (disabled) return null;

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        Mark as lost
      </Button>
    );
  }

  return (
    <form
      action={async () => {
        await markLeadLostAction(leadId, reason);
      }}
      className="space-y-2"
    >
      <Input
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button type="submit" variant="destructive" className="w-full">
        Confirm lost
      </Button>
    </form>
  );
}
