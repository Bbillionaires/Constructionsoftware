"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/signature-pad";
import { calcEstimateTotals } from "@/lib/estimate-calc";
import { formatCurrency, fromCents } from "@/lib/money";
import { approveEstimateAction, declineEstimateAction } from "@/lib/actions/portal";
import type { LineItemType } from "@prisma/client";

export type PortalLineItem = {
  id: string;
  type: LineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  isOptionalUpgrade: boolean;
};
export type PortalOption = {
  id: string;
  label: string;
  description: string | null;
  lineItems: PortalLineItem[];
};

export function ApproveForm({
  token,
  options,
  taxPercent,
}: {
  token: string;
  options: PortalOption[];
  taxPercent: number;
}) {
  const [optionId, setOptionId] = useState(options[0]?.id ?? "");
  const [acceptedUpgrades, setAcceptedUpgrades] = useState<Set<string>>(new Set());
  const [signing, setSigning] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [pending, startTransition] = useTransition();

  const option = options.find((o) => o.id === optionId) ?? options[0];

  const totals = useMemo(() => {
    if (!option) return null;
    const lineItems = option.lineItems.map((li) => ({
      type: li.type,
      description: li.description,
      quantity: li.quantity,
      unitCost: 0,
      unitPrice: li.unitPrice,
      isOptionalUpgrade: li.isOptionalUpgrade && !acceptedUpgrades.has(li.id),
    }));
    return calcEstimateTotals(lineItems, { taxPercent });
  }, [option, acceptedUpgrades, taxPercent]);

  function toggleUpgrade(id: string) {
    setAcceptedUpgrades((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(signatureDataUrl: string) {
    startTransition(() => {
      approveEstimateAction(token, {
        optionId,
        acceptedUpgradeLineItemIds: [...acceptedUpgrades],
        signerName: signerName || "Customer",
        signatureDataUrl,
      });
    });
  }

  if (!option) return null;

  return (
    <div className="space-y-4">
      {options.length > 1 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOptionId(o.id)}
              className={`rounded-lg border p-3 text-left ${o.id === optionId ? "border-primary ring-2 ring-primary/30" : ""}`}
            >
              <div className="font-semibold">{o.label}</div>
              {o.description && <div className="text-xs text-muted-foreground">{o.description}</div>}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{option.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {option.lineItems
            .filter((li) => !li.isOptionalUpgrade)
            .map((li) => (
              <div key={li.id} className="flex items-center justify-between text-sm">
                <span>{li.description}</span>
                <span>{formatCurrency(li.quantity * li.unitPrice)}</span>
              </div>
            ))}

          {option.lineItems.some((li) => li.isOptionalUpgrade) && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Optional upgrades</p>
              {option.lineItems
                .filter((li) => li.isOptionalUpgrade)
                .map((li) => (
                  <label key={li.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={acceptedUpgrades.has(li.id)}
                        onCheckedChange={() => toggleUpgrade(li.id)}
                      />
                      {li.description}
                    </span>
                    <span>{formatCurrency(li.quantity * li.unitPrice)}</span>
                  </label>
                ))}
            </div>
          )}

          {totals && (
            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{formatCurrency(fromCents(totals.taxCents))}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(fromCents(totals.totalCents))}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!signing && !declining && (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setSigning(true)}>
            Approve &amp; sign
          </Button>
          <Button variant="outline" onClick={() => setDeclining(true)}>
            Decline
          </Button>
        </div>
      )}

      {signing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign to approve</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="signerName">Your name</Label>
              <Input
                id="signerName"
                name="signerName"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                required
              />
            </div>
            <SignaturePad onCapture={submit} />
            {pending && <p className="text-sm text-muted-foreground">Submitting…</p>}
          </CardContent>
        </Card>
      )}

      {declining && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Let us know why (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Went with another company, price too high, etc."
            />
            <Button
              variant="destructive"
              onClick={() =>
                startTransition(() => declineEstimateAction(token, declineReason))
              }
              disabled={pending}
            >
              Confirm decline
            </Button>
          </CardContent>
        </Card>
      )}
      {declining && <Badge variant="outline">You can still change your mind and approve later.</Badge>}
    </div>
  );
}
