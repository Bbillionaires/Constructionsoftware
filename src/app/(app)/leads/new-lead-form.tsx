"use client";

import { useState } from "react";
import { createLeadAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SOURCES = [
  "PHONE",
  "WEBSITE",
  "GOOGLE",
  "GOOGLE_LSA",
  "FACEBOOK",
  "REFERRAL",
  "REPEAT_CUSTOMER",
  "WALK_IN",
  "MANUAL",
  "OTHER",
] as const;

type Customer = { id: string; firstName: string; lastName: string; phone: string | null };
type StaffMember = { id: string; name: string };

export function NewLeadForm({
  customers,
  staff,
  onDone,
}: {
  customers: Customer[];
  staff: StaffMember[];
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [source, setSource] = useState<string>("PHONE");

  return (
    <form
      action={async (formData) => {
        await createLeadAction(formData);
        onDone?.();
      }}
      className="space-y-3"
    >
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`rounded-md border px-3 py-1 ${mode === "new" ? "bg-primary text-primary-foreground" : ""}`}
        >
          New customer
        </button>
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`rounded-md border px-3 py-1 ${mode === "existing" ? "bg-primary text-primary-foreground" : ""}`}
        >
          Existing customer
        </button>
      </div>

      {mode === "existing" ? (
        <div className="space-y-1">
          <Label>Customer</Label>
          <select name="existingCustomerId" className="w-full rounded-md border px-3 py-2 text-sm" required>
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} {c.phone ? `(${c.phone})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>First name</Label>
            <Input name="firstName" required />
          </div>
          <div className="space-y-1">
            <Label>Last name</Label>
            <Input name="lastName" required />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Phone</Label>
          <Input name="phone" placeholder="(555) 555-1234" />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input name="email" type="email" />
        </div>
      </div>

      <p className="pt-1 text-xs font-medium text-muted-foreground">Service address (optional)</p>
      <Input name="addressLine1" placeholder="Address" />
      <div className="grid grid-cols-3 gap-3">
        <Input name="city" placeholder="City" />
        <Input name="state" placeholder="State" />
        <Input name="postalCode" placeholder="ZIP" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Lead source</Label>
          <Select value={source} onValueChange={(value) => setSource(value ?? "OTHER")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="source" value={source} />
        </div>
        <div className="space-y-1">
          <Label>Assign to</Label>
          <select name="assignedToId" className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Requested service</Label>
        <Input name="requestedService" placeholder="Fence repair, drywall patch, TV mounting…" required />
      </div>
      <div className="space-y-1">
        <Label>Description / notes</Label>
        <Textarea name="description" />
      </div>
      <div className="space-y-1">
        <Label>Estimated value ($)</Label>
        <Input name="estimatedValue" type="number" step="0.01" min="0" />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="wasMissedCall" name="wasMissedCall" />
        <Label htmlFor="wasMissedCall" className="font-normal">
          This started as a missed call — send the automatic missed-call text
        </Label>
      </div>

      <Button type="submit" className="w-full">
        Create lead
      </Button>
    </form>
  );
}
