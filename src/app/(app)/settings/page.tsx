import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, MANAGER_ROLES } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { decToNum } from "@/lib/estimate-totals";
import { CompanyProfileForm } from "./company-profile-form";

function IntegrationRow({
  name,
  live,
  liveLabel,
  devNote,
}: {
  name: string;
  live: boolean;
  liveLabel: string;
  devNote: string;
}) {
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <div>
        <div className="font-medium">{name}</div>
        <p className="text-xs text-muted-foreground">{live ? liveLabel : devNote}</p>
      </div>
      <Badge variant={live ? "default" : "outline"}>{live ? "Live" : "Simulated"}</Badge>
    </div>
  );
}

export default async function SettingsPage() {
  const session = await requireSession();
  assertRole(session, MANAGER_ROLES);

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });

  const emailLive = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const smsLive = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const paymentsLive = Boolean(
    (process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID) || process.env.STRIPE_SECRET_KEY
  );
  const paymentsProviderName = process.env.SQUARE_ACCESS_TOKEN ? "Square" : "Stripe";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your company profile and connected integrations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company profile</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyProfileForm
            company={{
              name: company.name,
              phone: company.phone,
              email: company.email,
              addressLine1: company.addressLine1,
              city: company.city,
              state: company.state,
              postalCode: company.postalCode,
              timezone: company.timezone,
              logoUrl: company.logoUrl,
              targetMarginPercent: decToNum(company.targetMarginPercent).toString(),
              defaultLaborRate: decToNum(company.defaultLaborRate).toString(),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="p-0 px-6 pb-2">
          <IntegrationRow
            name="Email"
            live={emailLive}
            liveLabel="Sending real email via Resend."
            devNote="No RESEND_API_KEY configured — emails are logged, not delivered."
          />
          <IntegrationRow
            name="SMS / Text"
            live={smsLive}
            liveLabel="Sending real text messages via Twilio."
            devNote="No SMS provider configured yet — texts are logged, not delivered."
          />
          <IntegrationRow
            name="Payments"
            live={paymentsLive}
            liveLabel={`Processing real charges via ${paymentsProviderName}.`}
            devNote="No payment provider configured — checkout uses a safe on-screen simulator."
          />
        </CardContent>
      </Card>
    </div>
  );
}
