"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Send, PlayCircle, Copy } from "lucide-react";
import { calcEstimateTotals, getMarginWarnings, type LineItemInput } from "@/lib/estimate-calc";
import { fromCents, formatCurrency, formatPercent } from "@/lib/money";
import {
  saveEstimateAction,
  sendEstimateAction,
  startJobNowAction,
  type EstimateSavePayload,
} from "@/lib/actions/estimates";
import type { EstimateOptionTier, EstimateStatus, LineItemType } from "@prisma/client";

let uid = 0;
const nextId = () => `tmp_${++uid}_${Date.now()}`;

type LineItem = LineItemInput & { id: string; priceBookItemId: string | null };
type Option = {
  id: string;
  tier: EstimateOptionTier;
  label: string;
  description: string;
  isSelected: boolean;
  lineItems: LineItem[];
};

export type PriceBookItemLite = {
  id: string;
  name: string;
  expectedLaborHours: number;
  materialAllowance: number;
  defaultMarkupPercent: number;
  targetMarginPercent: number;
};

const LINE_TYPES: LineItemType[] = [
  "LABOR",
  "MATERIAL",
  "EQUIPMENT",
  "TRAVEL",
  "DISPOSAL",
  "SUBCONTRACTOR",
  "OTHER",
];

export function EstimateBuilder({
  estimateId,
  status,
  publicToken,
  initialTitle,
  initialOptions,
  initialTaxPercent,
  initialDepositPercent,
  initialNotes,
  initialTerms,
  priceBookItems,
  companyDefaultLaborRate,
  companyTargetMargin,
  customerLabel,
  propertyLabel,
  hasJob,
}: {
  estimateId: string;
  status: EstimateStatus;
  publicToken: string;
  initialTitle: string;
  initialOptions: Option[];
  initialTaxPercent: number;
  initialDepositPercent: number | null;
  initialNotes: string;
  initialTerms: string;
  priceBookItems: PriceBookItemLite[];
  companyDefaultLaborRate: number;
  companyTargetMargin: number;
  customerLabel: string;
  propertyLabel: string;
  hasJob: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [activeTab, setActiveTab] = useState(initialOptions[0]?.id ?? "");
  const [taxPercent, setTaxPercent] = useState(initialTaxPercent);
  const [depositPercent, setDepositPercent] = useState(initialDepositPercent ?? 0);
  const [notes, setNotes] = useState(initialNotes);
  const [terms, setTerms] = useState(initialTerms);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const activeOption = options.find((o) => o.id === activeTab) ?? options[0];

  const totals = useMemo(() => {
    if (!activeOption) return null;
    return calcEstimateTotals(activeOption.lineItems, { taxPercent, depositPercent });
  }, [activeOption, taxPercent, depositPercent]);

  const warnings = totals ? getMarginWarnings(totals, companyTargetMargin) : [];

  function updateOption(optionId: string, patch: Partial<Option>) {
    setOptions((prev) => prev.map((o) => (o.id === optionId ? { ...o, ...patch } : o)));
  }

  function updateLineItem(optionId: string, lineId: string, patch: Partial<LineItem>) {
    setOptions((prev) =>
      prev.map((o) =>
        o.id !== optionId
          ? o
          : { ...o, lineItems: o.lineItems.map((li) => (li.id === lineId ? { ...li, ...patch } : li)) }
      )
    );
  }

  function addLineItem(optionId: string, type: LineItemType = "OTHER") {
    setOptions((prev) =>
      prev.map((o) =>
        o.id !== optionId
          ? o
          : {
              ...o,
              lineItems: [
                ...o.lineItems,
                { id: nextId(), type, description: "", quantity: 1, unitCost: 0, unitPrice: 0, isOptionalUpgrade: false, priceBookItemId: null },
              ],
            }
      )
    );
  }

  function removeLineItem(optionId: string, lineId: string) {
    setOptions((prev) =>
      prev.map((o) => (o.id !== optionId ? o : { ...o, lineItems: o.lineItems.filter((li) => li.id !== lineId) }))
    );
  }

  function addFromPriceBook(optionId: string, itemId: string) {
    const item = priceBookItems.find((p) => p.id === itemId);
    if (!item) return;
    const markup = 1 + item.defaultMarkupPercent / 100;
    const laborLine: LineItem = {
      id: nextId(),
      type: "LABOR",
      description: `${item.name} — Labor`,
      quantity: item.expectedLaborHours,
      unitCost: companyDefaultLaborRate,
      unitPrice: Math.round(companyDefaultLaborRate * markup * 100) / 100,
      isOptionalUpgrade: false,
      priceBookItemId: item.id,
    };
    const lines: LineItem[] = [laborLine];
    if (item.materialAllowance > 0) {
      lines.push({
        id: nextId(),
        type: "MATERIAL",
        description: `${item.name} — Materials`,
        quantity: 1,
        unitCost: item.materialAllowance,
        unitPrice: Math.round(item.materialAllowance * markup * 100) / 100,
        isOptionalUpgrade: false,
        priceBookItemId: item.id,
      });
    }
    setOptions((prev) =>
      prev.map((o) => (o.id !== optionId ? o : { ...o, lineItems: [...o.lineItems, ...lines] }))
    );
  }

  function addOption() {
    const tierOrder: EstimateOptionTier[] = ["GOOD", "BETTER", "BEST"];
    const used = new Set(options.map((o) => o.tier));
    const tier = tierOrder.find((t) => !used.has(t)) ?? "STANDARD";
    const newOption: Option = {
      id: nextId(),
      tier,
      label: tier.charAt(0) + tier.slice(1).toLowerCase(),
      description: "",
      isSelected: options.length === 0,
      lineItems: [],
    };
    setOptions((prev) => [...prev, newOption]);
    setActiveTab(newOption.id);
  }

  function buildPayload(): EstimateSavePayload {
    return {
      title,
      taxPercent,
      depositPercent: depositPercent || null,
      depositAmount: null,
      notes,
      terms,
      options: options.map((o) => ({
        tier: o.tier,
        label: o.label,
        description: o.description,
        isSelected: o.isSelected,
        lineItems: o.lineItems.map((li) => ({
          type: li.type,
          description: li.description,
          quantity: li.quantity,
          unitCost: li.unitCost,
          unitPrice: li.unitPrice,
          isOptionalUpgrade: li.isOptionalUpgrade,
          priceBookItemId: li.priceBookItemId,
        })),
      })),
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveEstimateAction(estimateId, buildPayload());
      toast.success("Estimate saved.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    await saveEstimateAction(estimateId, buildPayload());
    startTransition(async () => {
      const token = await sendEstimateAction(estimateId);
      const link = `${window.location.origin}/portal/${token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Estimate sent to customer — link also copied to clipboard.", { description: link });
      router.refresh();
    });
  }

  async function handleStartJobNow() {
    await saveEstimateAction(estimateId, buildPayload());
    startTransition(() => startJobNowAction(estimateId));
  }

  const portalLink =
    typeof window !== "undefined" ? `${window.location.origin}/portal/${publicToken}` : `/portal/${publicToken}`;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 space-y-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold"
            />
            <p className="text-sm text-muted-foreground">
              {customerLabel} · {propertyLabel}
            </p>
          </div>
          <Badge variant="outline">{status.replace(/_/g, " ")}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button onClick={handleSend} disabled={pending}>
            <Send className="mr-1 h-4 w-4" /> Send to customer
          </Button>
          {!hasJob && (
            <Button variant="secondary" onClick={handleStartJobNow} disabled={pending}>
              <PlayCircle className="mr-1 h-4 w-4" /> Start job now
            </Button>
          )}
          {status !== "DRAFT" && (
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(portalLink);
                toast.success("Customer link copied.");
              }}
            >
              <Copy className="mr-1 h-4 w-4" /> Copy customer link
            </Button>
          )}
        </div>

        <Tabs value={activeOption?.id} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              {options.map((o) => (
                <TabsTrigger key={o.id} value={o.id}>
                  {o.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {options.length < 3 && (
              <Button variant="ghost" size="sm" onClick={addOption}>
                <Plus className="mr-1 h-4 w-4" /> Add option
              </Button>
            )}
          </div>

          {options.map((o) => (
            <TabsContent key={o.id} value={o.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={o.label}
                  onChange={(e) => updateOption(o.id, { label: e.target.value })}
                  className="max-w-xs"
                />
                {options.length > 1 && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={o.isSelected}
                      onCheckedChange={() =>
                        setOptions((prev) => prev.map((p) => ({ ...p, isSelected: p.id === o.id })))
                      }
                    />
                    Primary option
                  </label>
                )}
              </div>

              <div className="space-y-2">
                {o.lineItems.map((li) => (
                  <div key={li.id} className="grid grid-cols-12 items-center gap-2 rounded-md border p-2">
                    <div className="col-span-2">
                      <Select
                        value={li.type}
                        onValueChange={(v) => v && updateLineItem(o.id, li.id, { type: v as LineItemType })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LINE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="col-span-4 h-8"
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) => updateLineItem(o.id, li.id, { description: e.target.value })}
                    />
                    <Input
                      className="col-span-1 h-8"
                      type="number"
                      step="0.01"
                      value={li.quantity}
                      onChange={(e) => updateLineItem(o.id, li.id, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                    <Input
                      className="col-span-2 h-8"
                      type="number"
                      step="0.01"
                      placeholder="Cost"
                      value={li.unitCost}
                      onChange={(e) => updateLineItem(o.id, li.id, { unitCost: parseFloat(e.target.value) || 0 })}
                    />
                    <Input
                      className="col-span-2 h-8"
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={li.unitPrice}
                      onChange={(e) => updateLineItem(o.id, li.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                    />
                    <label className="col-span-1 flex items-center justify-center" title="Optional upgrade">
                      <Checkbox
                        checked={li.isOptionalUpgrade}
                        onCheckedChange={(c) => updateLineItem(o.id, li.id, { isOptionalUpgrade: !!c })}
                      />
                    </label>
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeLineItem(o.id, li.id)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {o.lineItems.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No line items yet.</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => addLineItem(o.id)}>
                  <Plus className="mr-1 h-4 w-4" /> Custom line item
                </Button>
                <Select onValueChange={(v: string | null) => v && addFromPriceBook(o.id, v)}>
                  <SelectTrigger className="h-8 w-56 text-xs">
                    <SelectValue placeholder="Add from price book…" />
                  </SelectTrigger>
                  <SelectContent>
                    {priceBookItems.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes &amp; terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Customer-facing notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Terms</Label>
              <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="sticky top-4">
          <CardHeader>
            <CardTitle className="text-base">Profitability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {totals && (
              <>
                <Row label="Direct cost" value={formatCurrency(fromCents(totals.directCostCents))} />
                <Row label="Labor cost" value={formatCurrency(fromCents(totals.laborCostCents))} muted />
                <Row label="Material cost" value={formatCurrency(fromCents(totals.materialCostCents))} muted />
                <Row label="Other cost" value={formatCurrency(fromCents(totals.otherCostCents))} muted />
                <hr />
                <Row label="Selling price" value={formatCurrency(fromCents(totals.sellingPriceCents))} />
                <div className="space-y-1">
                  <Label className="text-xs">Discount / tax</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tax %</span>
                    <Input
                      name="taxPercent"
                      className="h-8 w-20"
                      type="number"
                      step="0.1"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-xs text-muted-foreground">Deposit %</span>
                    <Input
                      name="depositPercent"
                      className="h-8 w-20"
                      type="number"
                      step="1"
                      value={depositPercent}
                      onChange={(e) => setDepositPercent(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <Row label="Tax" value={formatCurrency(fromCents(totals.taxCents))} muted />
                <Row label="Total" value={formatCurrency(fromCents(totals.totalCents))} bold />
                <Row label="Deposit due" value={formatCurrency(fromCents(totals.depositCents))} muted />
                <hr />
                <Row label="Gross profit" value={formatCurrency(fromCents(totals.grossProfitCents))} bold />
                <Row label="Markup %" value={formatPercent(totals.markupPercent)} />
                <Row label="Margin %" value={formatPercent(totals.marginPercent)} />
                {totals.upgradeSellingPriceCents > 0 && (
                  <Row
                    label="Optional upgrades"
                    value={formatCurrency(fromCents(totals.upgradeSellingPriceCents))}
                    muted
                  />
                )}
                {warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`rounded-md p-2 text-xs ${
                      w.level === "danger" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {w.message}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""} ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
