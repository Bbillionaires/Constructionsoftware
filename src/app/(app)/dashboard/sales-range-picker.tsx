"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SALES_RANGE_PRESETS } from "@/lib/dashboard-ranges";
import { CalendarIcon } from "lucide-react";

export function SalesRangePicker({ activePreset }: { activePreset: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();

  function applyPreset(preset: string) {
    const params = new URLSearchParams(searchParams);
    params.set("range", preset);
    params.delete("from");
    params.delete("to");
    router.push(`/dashboard?${params.toString()}`);
  }

  function applyCustomRange() {
    if (!draftRange?.from || !draftRange?.to) return;
    const params = new URLSearchParams(searchParams);
    params.set("range", "custom");
    params.set("from", draftRange.from.toISOString().slice(0, 10));
    params.set("to", draftRange.to.toISOString().slice(0, 10));
    router.push(`/dashboard?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SALES_RANGE_PRESETS.map((p) => (
        <Button
          key={p.value}
          size="sm"
          variant={activePreset === p.value ? "default" : "outline"}
          onClick={() => applyPreset(p.value)}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button size="sm" variant={activePreset === "custom" ? "default" : "outline"} />}>
          <CalendarIcon />
          Custom
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar mode="range" numberOfMonths={2} selected={draftRange} onSelect={setDraftRange} />
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!draftRange?.from || !draftRange?.to} onClick={applyCustomRange}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
