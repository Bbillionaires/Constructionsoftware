import { confirmDevPaymentAction } from "@/lib/actions/dev-pay";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/money";
import { CreditCard } from "lucide-react";

export default async function DevPayPage({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string;
    reference?: string;
    amount?: string;
    description?: string;
    successUrl?: string;
    cancelUrl?: string;
  }>;
}) {
  const { ref, reference, amount, description, successUrl, cancelUrl } = await searchParams;
  const amountCents = Number(amount ?? 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" /> Development payment simulator
          </div>
          <CardTitle className="text-xl">{formatCurrency(amountCents / 100)}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            No STRIPE_SECRET_KEY is configured, so this is a simulated checkout — no real charge occurs.
            Any card details entered below are not stored or validated.
          </p>
          <form action={confirmDevPaymentAction} className="space-y-3">
            <input type="hidden" name="ref" value={ref} />
            <input type="hidden" name="reference" value={reference} />
            <input type="hidden" name="successUrl" value={successUrl} />
            <div className="space-y-1">
              <Label>Card number</Label>
              <Input defaultValue="4242 4242 4242 4242" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Expiry</Label>
                <Input defaultValue="12/30" />
              </div>
              <div className="space-y-1">
                <Label>CVC</Label>
                <Input defaultValue="123" />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Pay {formatCurrency(amountCents / 100)}
            </Button>
          </form>
          {cancelUrl && (
            <a href={cancelUrl} className="block text-center text-sm text-muted-foreground underline">
              Cancel
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
