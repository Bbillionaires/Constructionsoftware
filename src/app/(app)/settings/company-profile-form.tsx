"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanyProfileAction } from "@/lib/actions/settings";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export type CompanyProfile = {
  name: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  timezone: string;
  logoUrl: string | null;
  targetMarginPercent: string;
  defaultLaborRate: string;
};

export function CompanyProfileForm({ company }: { company: CompanyProfile }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await updateCompanyProfileAction(formData);
          toast.success("Company settings saved.");
        })
      }
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Company name</Label>
          <Input name="name" defaultValue={company.name} required />
        </div>
        <div className="space-y-1">
          <Label>Business phone</Label>
          <Input name="phone" type="tel" defaultValue={company.phone ?? ""} placeholder="(555) 200-4100" />
        </div>
        <div className="space-y-1">
          <Label>Business email</Label>
          <Input name="email" type="email" defaultValue={company.email ?? ""} placeholder="office@yourcompany.com" />
        </div>
        <div className="space-y-1">
          <Label>Logo URL</Label>
          <Input name="logoUrl" defaultValue={company.logoUrl ?? ""} placeholder="https://..." />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label>Street address</Label>
          <Input name="addressLine1" defaultValue={company.addressLine1 ?? ""} />
        </div>
        <div className="space-y-1">
          <Label>City</Label>
          <Input name="city" defaultValue={company.city ?? ""} />
        </div>
        <div className="space-y-1">
          <Label>State</Label>
          <Input name="state" defaultValue={company.state ?? ""} />
        </div>
        <div className="space-y-1">
          <Label>Postal code</Label>
          <Input name="postalCode" defaultValue={company.postalCode ?? ""} />
        </div>
        <div className="space-y-1">
          <Label>Timezone</Label>
          <select
            name="timezone"
            defaultValue={company.timezone}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Target gross margin %</Label>
          <Input
            name="targetMarginPercent"
            type="number"
            step="0.1"
            defaultValue={company.targetMarginPercent}
          />
          <p className="text-xs text-muted-foreground">Default profitability target used across the price book.</p>
        </div>
        <div className="space-y-1">
          <Label>Default labor rate ($/hr)</Label>
          <Input name="defaultLaborRate" type="number" step="0.01" defaultValue={company.defaultLaborRate} />
          <p className="text-xs text-muted-foreground">Used to cost out labor when a service has no override.</p>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
