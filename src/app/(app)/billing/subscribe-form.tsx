"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { subscribeAction } from "@/lib/actions/billing";

declare global {
  interface Window {
    Square?: {
      payments: (
        appId: string,
        locationId: string
      ) => { card: () => Promise<{ attach: (selector: string) => Promise<void>; tokenize: () => Promise<{ status: string; token?: string; errors?: unknown }> }> };
    };
  }
}

export function SubscribeForm({
  liveCardCaptureConfigured,
  squareApplicationId,
  squareLocationId,
  sandbox,
}: {
  liveCardCaptureConfigured: boolean;
  squareApplicationId?: string;
  squareLocationId?: string;
  sandbox: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [ready, setReady] = useState(false);
  const cardRef = useRef<{ tokenize: () => Promise<{ status: string; token?: string }> } | null>(null);

  useEffect(() => {
    if (!liveCardCaptureConfigured || !squareApplicationId || !squareLocationId) return;
    let cancelled = false;

    async function init() {
      if (!window.Square) {
        const script = document.createElement("script");
        script.src = sandbox ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js";
        script.async = true;
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Square"));
          document.body.appendChild(script);
        });
      }
      if (cancelled || !window.Square) return;
      const payments = window.Square.payments(squareApplicationId!, squareLocationId!);
      const card = await payments.card();
      await card.attach("#card-container");
      if (cancelled) return;
      cardRef.current = card;
      setReady(true);
    }

    init().catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't load the card form."));
    return () => {
      cancelled = true;
    };
  }, [liveCardCaptureConfigured, squareApplicationId, squareLocationId, sandbox]);

  function submit(cardSourceId: string) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("cardSourceId", cardSourceId);
        await subscribeAction(formData);
      } catch (e) {
        unstable_rethrow(e);
        toast.error(e instanceof Error ? e.message : "Subscription failed.");
      }
    });
  }

  if (!liveCardCaptureConfigured) {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          Development mode — no live Square subscription billing is configured, so this simulates a successful
          subscription instead of charging a real card.
        </p>
        <Button disabled={pending} onClick={() => submit("dev-simulated-card")}>
          {pending ? "Subscribing…" : `Simulate subscribe (dev)`}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sandbox && (
        <p className="text-xs text-muted-foreground">
          Test mode — use Square&apos;s test card <strong>4111 1111 1111 1111</strong>, any future expiry, any
          CVV, any postal code. No real charge happens.
        </p>
      )}
      <div id="card-container" className="rounded-md border p-3" />
      <Button
        disabled={!ready || pending}
        onClick={async () => {
          if (!cardRef.current) return;
          const result = await cardRef.current.tokenize();
          if (result.status !== "OK" || !result.token) {
            toast.error("Card details didn't validate — please check them and try again.");
            return;
          }
          submit(result.token);
        }}
      >
        {pending ? "Subscribing…" : "Subscribe"}
      </Button>
    </div>
  );
}
