"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NewLeadForm } from "./new-lead-form";
import { Plus } from "lucide-react";

type Customer = { id: string; firstName: string; lastName: string; phone: string | null };
type StaffMember = { id: string; name: string };

export function NewLeadDialog({ customers, staff }: { customers: Customer[]; staff: StaffMember[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-1 h-4 w-4" /> New lead
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <NewLeadForm customers={customers} staff={staff} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
