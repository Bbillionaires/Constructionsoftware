/**
 * Payment-provider abstraction. The app never touches raw card numbers —
 * it only ever stores a provider reference string. Checkout happens on the
 * provider's own hosted page (Stripe Checkout) or, in development, on a
 * clearly-labeled local simulation page that mimics the same redirect flow.
 */

export type CheckoutParams = {
  amountCents: number;
  description: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  /** opaque metadata carried through to the confirmation step */
  reference: string;
};

export type CheckoutSession = { url: string; providerRef: string };

export interface PaymentProvider {
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession>;
}

class DevPaymentProvider implements PaymentProvider {
  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    const providerRef = `dev_pay_${Date.now()}`;
    // Mirrors Stripe's {CHECKOUT_SESSION_ID} template substitution so both
    // providers can share the same successUrl-building call sites.
    const successUrl = params.successUrl.replace("{CHECKOUT_SESSION_ID}", providerRef);
    const url = `/pay/dev?ref=${encodeURIComponent(providerRef)}&reference=${encodeURIComponent(
      params.reference
    )}&amount=${params.amountCents}&description=${encodeURIComponent(
      params.description
    )}&successUrl=${encodeURIComponent(successUrl)}&cancelUrl=${encodeURIComponent(params.cancelUrl)}`;
    return { url, providerRef };
  }
}

class StripePaymentProvider implements PaymentProvider {
  constructor(private secretKey: string) {}

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": params.description,
      "line_items[0][price_data][unit_amount]": String(params.amountCents),
      "line_items[0][quantity]": "1",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.reference,
      ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Stripe checkout session creation failed: ${await res.text()}`);
    }

    const json = (await res.json()) as { id: string; url: string };
    return { url: json.url, providerRef: json.id };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const { STRIPE_SECRET_KEY } = process.env;
  if (STRIPE_SECRET_KEY) {
    return new StripePaymentProvider(STRIPE_SECRET_KEY);
  }
  return new DevPaymentProvider();
}
