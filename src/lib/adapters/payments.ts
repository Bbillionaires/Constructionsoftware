import { randomUUID } from "crypto";

/**
 * Payment-provider abstraction. The app never touches raw card numbers —
 * it only ever stores a provider reference string. Checkout happens on the
 * provider's own hosted page (Stripe Checkout, Square Checkout) or, in
 * development, on a clearly-labeled local simulation page that mimics the
 * same redirect flow.
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

/**
 * Square Checkout has no equivalent to Stripe's `{CHECKOUT_SESSION_ID}`
 * redirect-time substitution — instead Square appends its own `orderId`
 * (among others) to whatever redirect_url you give it. So the confirm pages
 * verify Square payments by reading `orderId` off the redirect, not
 * `providerRef` — see the `{CHECKOUT_SESSION_ID}` stripping below.
 */
class SquarePaymentProvider implements PaymentProvider {
  constructor(private accessToken: string, private locationId: string) {}

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    const redirectUrl = params.successUrl.replace(/[?&]providerRef=\{CHECKOUT_SESSION_ID\}/, "");

    const res = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-10-17",
      },
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        order: {
          location_id: this.locationId,
          reference_id: params.reference,
          line_items: [
            {
              name: params.description,
              quantity: "1",
              base_price_money: { amount: params.amountCents, currency: "USD" },
            },
          ],
        },
        checkout_options: { redirect_url: redirectUrl },
      }),
    });

    if (!res.ok) {
      throw new Error(`Square checkout link creation failed: ${await res.text()}`);
    }

    const json = (await res.json()) as { payment_link: { id: string; url: string; order_id: string } };
    return { url: json.payment_link.url, providerRef: json.payment_link.id };
  }
}

/** Fetches a Square order and reports whether it has been fully paid. */
export async function verifySquareOrderPaid(orderId: string): Promise<boolean> {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) return false;

  const res = await fetch(`https://connect.squareup.com/v2/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": "2024-10-17" },
  });
  if (!res.ok) return false;

  const json = (await res.json()) as { order?: { state?: string } };
  return json.order?.state === "COMPLETED";
}

export function getPaymentProvider(): PaymentProvider {
  const { SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, STRIPE_SECRET_KEY } = process.env;
  if (SQUARE_ACCESS_TOKEN && SQUARE_LOCATION_ID) {
    return new SquarePaymentProvider(SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID);
  }
  if (STRIPE_SECRET_KEY) {
    return new StripePaymentProvider(STRIPE_SECRET_KEY);
  }
  return new DevPaymentProvider();
}
