"use client";

import { useState } from "react";
import { createEstimateAction } from "@/lib/actions/estimates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Property = { id: string; addressLine1: string; city: string };
type Customer = { id: string; firstName: string; lastName: string; properties: Property[] };

export function EstimateStartForm({
  customers,
  defaultCustomerId,
  defaultPropertyId,
  leadId,
  defaultTitle,
}: {
  customers: Customer[];
  defaultCustomerId?: string;
  defaultPropertyId?: string;
  leadId?: string;
  defaultTitle?: string;
}) {
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const properties = customers.find((c) => c.id === customerId)?.properties ?? [];

  return (
    <form action={createEstimateAction} className="space-y-4">
      {leadId && <input type="hidden" name="leadId" value={leadId} />}

      <div className="space-y-1">
        <Label>Customer</Label>
        <select
          name="customerId"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          required
        >
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label>Property</Label>
        <select
          name="propertyId"
          defaultValue={defaultPropertyId}
          className="w-full rounded-md border px-3 py-2 text-sm"
          required
        >
          <option value="">Select a property…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.addressLine1}, {p.city}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label>Estimate title</Label>
        <Input name="title" defaultValue={defaultTitle ?? "Service estimate"} required />
      </div>

      <Button type="submit" className="w-full">
        Start building
      </Button>
    </form>
  );
}
