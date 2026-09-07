/**
 * Voice-to-quote: a contractor records themselves describing a job out
 * loud — the labor involved, the materials needed, and who supplies them —
 * and this adapter turns that recording into a structured draft estimate.
 * Two model calls against Cloudflare Workers AI: Whisper transcribes the
 * audio, then a Llama instruct model extracts structured line items from
 * the transcript. Swap in a different Workers AI model (or a different
 * provider entirely) here without touching any call site.
 */

import { getRegionalCostMultiplier } from "@/lib/regional-pricing";

export type ExtractedLineItem = {
  type: "LABOR" | "MATERIAL";
  description: string;
  supplier?: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
};

export type VoiceQuoteResult = {
  transcript: string;
  title: string;
  lineItems: ExtractedLineItem[];
};

export type JobLocation = { city?: string | null; state?: string | null; postalCode?: string | null };

export interface VoiceQuoteProvider {
  process(audio: Buffer, mimeType: string, location?: JobLocation): Promise<VoiceQuoteResult>;
}

class DevVoiceQuoteProvider implements VoiceQuoteProvider {
  async process(): Promise<VoiceQuoteResult> {
    return {
      transcript:
        "[Development mode — no CLOUDFLARE_API_TOKEN configured, so this is a simulated transcript, not your real recording.] " +
        "Replacing the kitchen faucet, about two hours of labor, and we need a new faucet from Ferguson supply.",
      title: "Voice quote (simulated)",
      lineItems: [
        {
          type: "LABOR",
          description: "Simulated labor line — describe the work out loud once a real provider is configured",
          quantity: 2,
          unitCost: 25,
          unitPrice: 50,
        },
        {
          type: "MATERIAL",
          description: "Simulated material line",
          supplier: "Simulated Supply Co.",
          quantity: 1,
          unitCost: 40,
          unitPrice: 60,
        },
      ],
    };
  }
}

// Common material/hardware suppliers a US contractor is likely to say out loud.
// Whisper transcription regularly mishears these (e.g. "Lowe's" -> "Lowell"),
// so the extraction model gets the list as context to correct obvious
// mishearings, and parseExtractionResponse below does a fuzzy-match pass as
// a safety net. Genuinely local/unlisted suppliers are left as spoken —
// this only corrects near-misses of names on the list, never invents one.
const KNOWN_SUPPLIERS = [
  "Home Depot",
  "Lowe's",
  "Menards",
  "Ace Hardware",
  "True Value",
  "Ferguson",
  "Grainger",
  "HD Supply",
  "ABC Supply",
  "84 Lumber",
  "SiteOne Landscape Supply",
  "Sherwin-Williams",
  "White Cap",
  "Floor & Decor",
  "Build.com",
];

function buildExtractionSystemPrompt(locationLabel?: string): string {
  return `You turn a contractor's spoken job description into a structured quote.
Read the transcript and output ONLY a single JSON object (no markdown, no commentary) matching this shape:
{
  "title": "short job title, 5 words or fewer",
  "lineItems": [
    { "type": "LABOR", "description": "...", "quantity": <hours, number>, "unitCost": <contractor's hourly cost, number>, "unitPrice": <what to charge the customer per hour, number> },
    { "type": "MATERIAL", "description": "...", "supplier": "supplier name if mentioned, else omit", "quantity": <number>, "unitCost": <contractor's cost, number>, "unitPrice": <price charged to customer, number>, "priceSpoken": <true if the contractor said an actual price for this item, false if you had to estimate it> }
  ]
}
Rules:
- Create one LABOR line per distinct task mentioned, and one MATERIAL line per distinct material.
- If no price was spoken for a MATERIAL item, set "priceSpoken": false and put a reasonable NATIONAL AVERAGE US market price in unitCost (mark unitPrice as unitCost * 1.5) — do not try to adjust it for the job's location yourself${locationLabel ? `; the app applies its own regional cost adjustment for ${locationLabel} afterward` : ""}. If the contractor did say a price, set "priceSpoken": true and use exactly what they said.
- If nothing usable was said, return a single LABOR line with description "Could not understand recording — please edit manually" and zero amounts.
- The transcript comes from speech-to-text and can mishear supplier names. Common suppliers contractors mention include: ${KNOWN_SUPPLIERS.join(", ")}. If a word in the transcript is clearly a mishearing of one of these (e.g. "Lowell" almost certainly means "Lowe's" in a materials context), use the correct name. Only do this when the mishearing is obvious — don't force an unrelated or local supplier's name into this list.
- Never include any text outside the JSON object.`;
}

class CloudflareVoiceQuoteProvider implements VoiceQuoteProvider {
  constructor(
    private accountId: string,
    private apiToken: string
  ) {}

  private async run(model: string, body: BodyInit, contentType: string) {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiToken}`, "Content-Type": contentType },
        body,
      }
    );
    if (!res.ok) throw new Error(`Cloudflare Workers AI (${model}) failed: ${await res.text()}`);
    return res.json();
  }

  async process(audio: Buffer, mimeType: string, location?: JobLocation): Promise<VoiceQuoteResult> {
    // Whisper on Workers AI rejects a generic application/octet-stream body
    // with "Invalid input" — it needs the real audio/* content type to know
    // how to decode the recording.
    const whisper = (await this.run(
      "@cf/openai/whisper-large-v3-turbo",
      new Uint8Array(audio),
      mimeType || "audio/webm"
    )) as { result: { text: string } };
    const transcript = whisper.result.text.trim();

    const regional = location ? getRegionalCostMultiplier(location) : undefined;

    const llm = (await this.run(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      JSON.stringify({
        messages: [
          { role: "system", content: buildExtractionSystemPrompt(regional?.label) },
          { role: "user", content: transcript },
        ],
      }),
      "application/json"
    )) as {
      result: {
        response?: string | object;
        choices?: { message?: { content?: string } }[];
      };
    };

    // Prefer the standard OpenAI-compatible choices[0].message.content (always
    // the raw string) — result.response is a Cloudflare convenience field that
    // can come back already parsed into an object instead of a JSON string,
    // depending on the model, which breaks a plain string-based JSON extract.
    const rawContent =
      llm.result.choices?.[0]?.message?.content ??
      (typeof llm.result.response === "string" ? llm.result.response : JSON.stringify(llm.result.response ?? {}));

    const parsed = parseExtractionResponse(rawContent, regional?.multiplier ?? 1);
    return { transcript, title: parsed.title, lineItems: parsed.lineItems };
  }
}

/** The model's output is free text that should contain one JSON object — pull it out defensively. */
function parseExtractionResponse(
  raw: string,
  regionalMultiplier = 1
): { title: string; lineItems: ExtractedLineItem[] } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallbackExtraction();
  try {
    const json = JSON.parse(match[0]) as { title?: unknown; lineItems?: unknown };
    if (!Array.isArray(json.lineItems) || json.lineItems.length === 0) return fallbackExtraction();
    const lineItems: ExtractedLineItem[] = json.lineItems
      .filter((li): li is Record<string, unknown> => typeof li === "object" && li !== null)
      .map((li) => {
        const type = li.type === "MATERIAL" ? "MATERIAL" : "LABOR";
        let unitCost = Number(li.unitCost) >= 0 ? Number(li.unitCost) : 0;
        let unitPrice = Number(li.unitPrice) >= 0 ? Number(li.unitPrice) : 0;

        // Only ever adjust a price the model had to guess (priceSpoken === false)
        // — a price the contractor actually said out loud is never rescaled.
        if (type === "MATERIAL" && li.priceSpoken === false && regionalMultiplier !== 1) {
          unitCost = Math.round(unitCost * regionalMultiplier * 100) / 100;
          unitPrice = Math.round(unitPrice * regionalMultiplier * 100) / 100;
        }

        return {
          type,
          description:
            typeof li.description === "string" && li.description.trim() ? li.description : "Untitled item",
          supplier:
            typeof li.supplier === "string" && li.supplier.trim() ? correctSupplierName(li.supplier) : undefined,
          quantity: Number(li.quantity) > 0 ? Number(li.quantity) : 1,
          unitCost,
          unitPrice,
        };
      });
    return {
      title: typeof json.title === "string" && json.title.trim() ? json.title.slice(0, 100) : "Voice quote",
      lineItems,
    };
  } catch {
    return fallbackExtraction();
  }
}

function normalizeSupplierName(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}

/**
 * Safety net for the extraction model's own supplier-name correction: snaps a
 * near-miss (transcription artifact like "Lowell") to the closest known
 * supplier when it's close enough to be clearly the same word, otherwise
 * leaves it untouched — a real local/unlisted supplier should never get
 * rewritten into an unrelated name on the list.
 */
function correctSupplierName(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return cleaned;
  const normalizedRaw = normalizeSupplierName(cleaned);

  let best: { supplier: string; distance: number } | null = null;
  for (const supplier of KNOWN_SUPPLIERS) {
    const distance = levenshteinDistance(normalizedRaw, normalizeSupplierName(supplier));
    if (!best || distance < best.distance) best = { supplier, distance };
  }
  if (!best) return cleaned;

  const threshold = Math.max(1, Math.round(normalizeSupplierName(best.supplier).length * 0.35));
  return best.distance <= threshold ? best.supplier : cleaned;
}

function fallbackExtraction(): { title: string; lineItems: ExtractedLineItem[] } {
  return {
    title: "Voice quote (needs review)",
    lineItems: [
      {
        type: "LABOR",
        description: "Couldn't understand the recording — please edit this estimate manually",
        quantity: 1,
        unitCost: 0,
        unitPrice: 0,
      },
    ],
  };
}

export function getVoiceQuoteProvider(): VoiceQuoteProvider {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
  if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN) {
    return new CloudflareVoiceQuoteProvider(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN);
  }
  return new DevVoiceQuoteProvider();
}
