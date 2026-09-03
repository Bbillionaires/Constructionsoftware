/**
 * SMS provider abstraction. Business logic never talks to Twilio directly —
 * it calls sendSms() and records the result as a Communication row itself.
 * Swap DevSmsProvider for a real Twilio-backed one by setting the
 * TWILIO_* env vars; no call-site code changes required.
 */

export type SendResult = { ok: boolean; providerRef?: string; error?: string };

export interface SmsProvider {
  send(to: string, body: string): Promise<SendResult>;
}

class DevSmsProvider implements SmsProvider {
  async send(to: string, body: string): Promise<SendResult> {
    // Development implementation: no external network call. Logs so the
    // message is visible during local testing / demos.
    console.log(`[dev-sms] -> ${to}: ${body}`);
    return { ok: true, providerRef: `dev_sms_${Date.now()}` };
  }
}

class TwilioSmsProvider implements SmsProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string
  ) {}

  async send(to: string, body: string): Promise<SendResult> {
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: this.fromNumber, Body: body }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text };
    }
    const json = (await res.json()) as { sid: string };
    return { ok: true, providerRef: json.sid };
  }
}

export function getSmsProvider(): SmsProvider {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    return new TwilioSmsProvider(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER);
  }
  return new DevSmsProvider();
}
