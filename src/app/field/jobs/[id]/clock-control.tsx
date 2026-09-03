"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clockInAction, clockOutAction } from "@/lib/actions/time-entries";
import { Clock } from "lucide-react";

export function ClockControl({ jobId, openEntryId }: { jobId: string; openEntryId: string | null }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      className="w-full"
      variant={openEntryId ? "destructive" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (openEntryId) await clockOutAction(openEntryId);
          else await clockInAction(jobId);
          router.refresh();
        })
      }
    >
      <Clock className="mr-1 h-4 w-4" /> {openEntryId ? "Clock out" : "Clock in"}
    </Button>
  );
}
