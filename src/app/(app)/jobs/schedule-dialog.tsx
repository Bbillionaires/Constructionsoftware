"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { scheduleJobAction } from "@/lib/actions/jobs";
import { CalendarPlus } from "lucide-react";

type Technician = { id: string; name: string };

export function ScheduleDialog({
  jobId,
  technicians,
  defaultDate,
  defaultTechnicianIds,
  trigger,
}: {
  jobId: string;
  technicians: Technician[];
  defaultDate?: string;
  defaultTechnicianIds?: string[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = scheduleJobAction.bind(null, jobId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={trigger ? "ghost" : "default"} />}>
        {trigger ?? (
          <>
            <CalendarPlus className="mr-1 h-4 w-4" /> Schedule
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule job</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input name="date" type="date" defaultValue={defaultDate} required />
            </div>
            <div className="space-y-1">
              <Label>Start time</Label>
              <Input name="startTime" type="time" defaultValue="09:00" required />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Duration (hours)</Label>
            <Input name="durationHours" type="number" step="0.5" defaultValue="2" required />
          </div>
          <div className="space-y-1">
            <Label>Technicians</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {technicians.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    name="technicianIds"
                    value={t.id}
                    defaultChecked={defaultTechnicianIds?.includes(t.id)}
                  />
                  {t.name}
                </label>
              ))}
              {technicians.length === 0 && (
                <p className="text-xs text-muted-foreground">No technicians yet — add some under Team.</p>
              )}
            </div>
          </div>
          <Button type="submit" className="w-full">
            Save schedule
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
