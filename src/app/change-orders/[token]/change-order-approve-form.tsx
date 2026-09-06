"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/signature-pad";
import { formatCurrency } from "@/lib/money";
import { approveChangeOrderPortalAction, declineChangeOrderPortalAction } from "@/lib/actions/change-orders";

export function ChangeOrderApproveForm({
  token,
  totalAmount,
}: {
  token: string;
  totalAmount: number;
}) {
  const [signing, setSigning] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(signatureDataUrl: string) {
    startTransition(() => {
      approveChangeOrderPortalAction(token, { signerName: signerName || "Customer", signatureDataUrl });
    });
  }

  if (!signing && !declining) {
    return (
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setSigning(true)}>
          Approve &amp; sign — {formatCurrency(totalAmount)}
        </Button>
        <Button variant="outline" onClick={() => setDeclining(true)}>
          Decline
        </Button>
      </div>
    );
  }

  if (declining) {
    return (
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decline this change?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The additional work won&apos;t be added to your job or invoice.
            </p>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => startTransition(() => declineChangeOrderPortalAction(token))}
            >
              Confirm decline
            </Button>
          </CardContent>
        </Card>
        <Badge variant="outline">You can still change your mind and approve later.</Badge>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign to approve</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="signerName">Your name</Label>
          <Input id="signerName" value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
        </div>
        <SignaturePad onCapture={submit} />
        {pending && <p className="text-sm text-muted-foreground">Submitting…</p>}
      </CardContent>
    </Card>
  );
}
