import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEstimateTotals } from "@/lib/estimate-totals";
import { formatCurrency, fromCents } from "@/lib/money";
import { startDepositCheckoutAction } from "@/lib/actions/portal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default async function DepositPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { publicToken: token },
    include: { options: { include: { lineItems: true } }, company: true },
  });
  if (!estimate) notFound();

  const totals = getEstimateTotals(estimate);
  const action = startDepositCheckoutAction.bind(null, token);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" /> Approved
          </div>
          <CardTitle>Secure your appointment</CardTitle>
          <CardDescription>
            {totals.depositCents > 0
              ? `A deposit of ${formatCurrency(fromCents(totals.depositCents))} is required to schedule your job.`
              : "No deposit is required — we'll be in touch to schedule your job."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action}>
            <Button type="submit" className="w-full">
              {totals.depositCents > 0
                ? `Pay deposit — ${formatCurrency(fromCents(totals.depositCents))}`
                : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
