import { randomUUID } from "crypto";
import { SUBSCRIPTION_PRICE_DOLLARS } from "@/lib/billing";

/**
 * Recurring subscription billing (the $11/mo plan) — separate from
 * adapters/payments.ts, which only ever runs one-off job/deposit charges.
 * Square has no hosted "subscription checkout link" the way its one-time
 * Checkout API does; a card must be tokenized client-side (Square Web
 * Payments SDK) into a one-time source_id, which this adapter turns into a
 * saved Card on File, then a Subscription against a Catalog plan.
 */

const PLAN_NAME = "Contractor OS Monthly";

export type SubscribeParams = {
  companyName: string;
  email?: string;
  /** One-time token from the Square Web Payments SDK card form. */
  cardSourceId: string;
};

export type SubscribeResult = { customerId: string; cardId: string; subscriptionId: string };

export interface SubscriptionProvider {
  subscribe(params: SubscribeParams): Promise<SubscribeResult>;
}

class DevSubscriptionProvider implements SubscriptionProvider {
  async subscribe(): Promise<SubscribeResult> {
    return {
      customerId: `dev_cust_${Date.now()}`,
      cardId: `dev_card_${Date.now()}`,
      subscriptionId: `dev_sub_${Date.now()}`,
    };
  }
}

class SquareSubscriptionProvider implements SubscriptionProvider {
  constructor(
    private accessToken: string,
    private locationId: string
  ) {}

  private async square(path: string, init: RequestInit) {
    const res = await fetch(`https://connect.squareup.com/v2${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-10-17",
        ...init.headers,
      },
    });
    if (!res.ok) throw new Error(`Square ${path} failed: ${await res.text()}`);
    return res.json();
  }

  private async getOrCreatePlanVariationId(): Promise<string> {
    const search = (await this.square("/catalog/search-catalog-items", {
      method: "POST",
      body: JSON.stringify({ text_filter: PLAN_NAME }),
    }).catch(() => null)) as { items?: { id: string; item_data?: { name?: string } }[] } | null;

    const existing = search?.items?.find((i) => i.item_data?.name === PLAN_NAME);
    if (existing) {
      const full = (await this.square(`/catalog/object/${existing.id}`, { method: "GET" })) as {
        object: { item_data?: { subscription_plan_variations?: { id: string }[] } };
      };
      const variationId = full.object.item_data?.subscription_plan_variations?.[0]?.id;
      if (variationId) return variationId;
    }

    const planId = `#plan_${randomUUID()}`;
    const variationId = `#variation_${randomUUID()}`;
    const created = (await this.square("/catalog/object", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        object: {
          type: "SUBSCRIPTION_PLAN",
          id: planId,
          subscription_plan_data: {
            name: PLAN_NAME,
            subscription_plan_variations: [
              {
                type: "SUBSCRIPTION_PLAN_VARIATION",
                id: variationId,
                subscription_plan_variation_data: {
                  name: `${PLAN_NAME} — $${SUBSCRIPTION_PRICE_DOLLARS}`,
                  phases: [
                    {
                      cadence: "MONTHLY",
                      recurring_price_money: { amount: SUBSCRIPTION_PRICE_DOLLARS * 100, currency: "USD" },
                    },
                  ],
                },
              },
            ],
          },
        },
      }),
    })) as { id_mappings: { client_object_id: string; object_id: string }[] };

    const mapped = created.id_mappings.find((m) => m.client_object_id === variationId);
    if (!mapped) throw new Error("Square did not return the new plan variation id.");
    return mapped.object_id;
  }

  async subscribe(params: SubscribeParams): Promise<SubscribeResult> {
    const customer = (await this.square("/customers", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        given_name: params.companyName,
        email_address: params.email,
      }),
    })) as { customer: { id: string } };

    const card = (await this.square("/cards", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        source_id: params.cardSourceId,
        card: { customer_id: customer.customer.id },
      }),
    })) as { card: { id: string } };

    const planVariationId = await this.getOrCreatePlanVariationId();

    const subscription = (await this.square("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        location_id: this.locationId,
        plan_variation_id: planVariationId,
        customer_id: customer.customer.id,
        card_id: card.card.id,
      }),
    })) as { subscription: { id: string } };

    return {
      customerId: customer.customer.id,
      cardId: card.card.id,
      subscriptionId: subscription.subscription.id,
    };
  }
}

export function getSubscriptionProvider(): SubscriptionProvider {
  const { SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID } = process.env;
  if (SQUARE_ACCESS_TOKEN && SQUARE_LOCATION_ID) {
    return new SquareSubscriptionProvider(SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID);
  }
  return new DevSubscriptionProvider();
}
