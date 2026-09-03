"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createOrUpdatePriceBookItemAction, deletePriceBookItemAction } from "@/lib/actions/price-book";

export type PriceBookCategory = { id: string; name: string };

export type PriceBookItemValues = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  standardPrice: string;
  minimumPrice: string | null;
  expectedLaborHours: string;
  expectedCrewSize: number;
  materialAllowance: string | null;
  defaultMarkupPercent: string;
  targetMarginPercent: string;
  estimatedDurationMinutes: number | null;
  requiredSkills: string[];
  warrantyDays: number | null;
  permitWarning: string | null;
  isActive: boolean;
};

export function PriceBookItemForm({
  categories,
  item,
}: {
  categories: PriceBookCategory[];
  item?: PriceBookItemValues;
}) {
  const action = createOrUpdatePriceBookItemAction.bind(null, item?.id ?? null);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Service name</Label>
          <Input name="name" defaultValue={item?.name} required />
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <select
            name="categoryId"
            defaultValue={item?.categoryId ?? ""}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>New category (optional — leave category above blank)</Label>
        <Input name="newCategoryName" placeholder="e.g. Plumbing" />
      </div>

      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea name="description" defaultValue={item?.description ?? ""} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Standard price ($)</Label>
          <Input name="standardPrice" type="number" step="0.01" defaultValue={item?.standardPrice ?? "0"} required />
        </div>
        <div className="space-y-1">
          <Label>Minimum price ($)</Label>
          <Input name="minimumPrice" type="number" step="0.01" defaultValue={item?.minimumPrice ?? ""} />
        </div>
        <div className="space-y-1">
          <Label>Material allowance ($)</Label>
          <Input name="materialAllowance" type="number" step="0.01" defaultValue={item?.materialAllowance ?? ""} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Expected labor hours</Label>
          <Input
            name="expectedLaborHours"
            type="number"
            step="0.1"
            defaultValue={item?.expectedLaborHours ?? "1"}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Expected crew size</Label>
          <Input name="expectedCrewSize" type="number" min={1} defaultValue={item?.expectedCrewSize ?? 1} />
        </div>
        <div className="space-y-1">
          <Label>Est. duration (minutes)</Label>
          <Input
            name="estimatedDurationMinutes"
            type="number"
            defaultValue={item?.estimatedDurationMinutes ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Default markup %</Label>
          <Input
            name="defaultMarkupPercent"
            type="number"
            step="0.1"
            defaultValue={item?.defaultMarkupPercent ?? "50"}
          />
        </div>
        <div className="space-y-1">
          <Label>Target margin %</Label>
          <Input
            name="targetMarginPercent"
            type="number"
            step="0.1"
            defaultValue={item?.targetMarginPercent ?? "45"}
          />
        </div>
        <div className="space-y-1">
          <Label>Warranty (days)</Label>
          <Input name="warrantyDays" type="number" defaultValue={item?.warrantyDays ?? ""} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Required skills (comma-separated)</Label>
        <Input name="requiredSkills" defaultValue={item?.requiredSkills?.join(", ") ?? ""} />
      </div>

      <div className="space-y-1">
        <Label>Permit / license warning (optional)</Label>
        <Input name="permitWarning" defaultValue={item?.permitWarning ?? ""} />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="isActive" name="isActive" defaultChecked={item?.isActive ?? true} />
        <Label htmlFor="isActive" className="font-normal">
          Active — show in the estimator
        </Label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {item ? "Save changes" : "Create service"}
        </Button>
        {item && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this service? This cannot be undone.")) {
                deletePriceBookItemAction(item.id);
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
