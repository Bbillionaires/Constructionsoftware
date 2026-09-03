"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runDueFollowUpsAction } from "@/lib/actions/estimate-followups";
import { RefreshCw } from "lucide-react";

export function RunFollowUpsButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await runDueFollowUpsAction();
          toast.success(
            `Sent ${result.followUps} follow-up${result.followUps === 1 ? "" : "s"} and ${result.reviews} review request${result.reviews === 1 ? "" : "s"}.`
          );
        })
      }
    >
      <RefreshCw className="mr-1 h-4 w-4" /> Run due follow-ups now
    </Button>
  );
}
