import type { SendResult } from "@/lib/adapters/sms";

export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<SendResult>;
}

class DevEmailProvider implements EmailProvider {
  async send(to: string, subject: string, html: string): Promise<SendResult> {
    console.log(`[dev-email] -> ${to} | ${subject}\n${html}`);
    return { ok: true, providerRef: `dev_email_${Date.now()}` };
  }
}

class ResendEmailProvider implements EmailProvider {
  constructor(private apiKey: string, private from: string) {}

  async send(to: string, subject: string, html: string): Promise<SendResult> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to, subject, html }),
    });
    if (!res.ok) {
      return { ok: false, error: await res.text() };
    }
    const json = (await res.json()) as { id: string };
    return { ok: true, providerRef: json.id };
  }
}

export function getEmailProvider(): EmailProvider {
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (RESEND_API_KEY && EMAIL_FROM) {
    return new ResendEmailProvider(RESEND_API_KEY, EMAIL_FROM);
  }
  return new DevEmailProvider();
}
