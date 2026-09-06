"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/money";
import {
  createChangeOrderAction,
  voidChangeOrderAction,
  markChangeOrderStatusAction,
} from "@/lib/actions/change-orders";
import { Copy, Trash2 } from "lucide-react";

export type ChangeOrderRow = {
  id: string;
  description: string;
  laborAmount: string;
  materialAmount: string;
  totalAmount: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  publicToken: string;
  createdAt: string;
};

const STATUS_VARIANT: Record<ChangeOrderRow["status"], "outline" | "default" | "destructive"> = {
  PENDING: "outline",
  APPROVED: "default",
  DECLINED: "destructive",
};

export function ChangeOrdersPanel({
  jobId,
  changeOrders,
  canManage,
}: {
  jobId: string;
  changeOrders: ChangeOrderRow[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const createAction = createChangeOrderAction.bind(null, jobId);

  function copyLink(token: string) {
    const link = `${window.location.origin}/change-orders/${token}`;
    navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Customer link copied.", { description: link });
  }

  function runAction(promise: Promise<unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        await promise;
        toast.success(successMessage);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That didn't work.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form
        action={createAction}
        className="flex flex-wrap items-end gap-2 rounded-md border p-3"
      >
        <div className="flex-1 basis-56">
          <Label className="text-xs text-muted-foreground">Description of change</Label>
          <Input name="description" placeholder="Customer requested an added closet shelf" required />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Labor ($)</Label>
          <Input name="laborAmount" type="number" step="0.01" min="0" defaultValue="0" className="w-28" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Materials ($)</Label>
          <Input name="materialAmount" type="number" step="0.01" min="0" defaultValue="0" className="w-28" />
        </div>
        <Button type="submit" size="sm">
          Create &amp; send
        </Button>
      </form>

      <div className="rounded-md border">
        {changeOrders.map((co) => (
          <div key={co.id} className="flex items-center justify-between gap-3 border-b p-3 text-sm last:border-0">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{co.description}</div>
              <div className="text-xs text-muted-foreground">
                Labor {formatCurrency(co.laborAmount)} · Materials {formatCurrency(co.materialAmount)} ·{" "}
                {new Date(co.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatCurrency(co.totalAmount)}</span>
              <Badge variant={STATUS_VARIANT[co.status]}>{co.status}</Badge>
              {co.status === "PENDING" && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => copyLink(co.publicToken)} title="Copy customer link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          runAction(
                            markChangeOrderStatusAction(co.id, jobId, "APPROVED"),
                            "Marked approved."
                          )
                        }
                      >
                        Mark approved
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          runAction(
                            markChangeOrderStatusAction(co.id, jobId, "DECLINED"),
                            "Marked declined."
                          )
                        }
                      >
                        Mark declined
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => runAction(voidChangeOrderAction(co.id, jobId), "Voided.")}
                        title="Void — created by mistake"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {changeOrders.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            No change orders yet — create one when the scope of work changes.
          </p>
        )}
      </div>
    </div>
  );
}
