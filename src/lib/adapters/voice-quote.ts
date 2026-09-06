/**
 * Voice-to-quote: a contractor records themselves describing a job out
 * loud — the labor involved, the materials needed, and who supplies them —
 * and this adapter turns that recording into a structured draft estimate.
 * Two model calls against Cloudflare Workers AI: Whisper transcribes the
 * audio, then a Llama instruct model extracts structured line items from
 * the transcript. Swap in a different Workers AI model (or a different
 * provider entirely) here without touching any call site.
 */

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

export interface VoiceQuoteProvider {
  process(audio: Buffer, mimeType: string): Promise<VoiceQuoteResult>;
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

const EXTRACTION_SYSTEM_PROMPT = `You turn a contractor's spoken job description into a structured quote.
Read the transcript and output ONLY a single JSON object (no markdown, no commentary) matching this shape:
{
  "title": "short job title, 5 words or fewer",
  "lineItems": [
    { "type": "LABOR", "description": "...", "quantity": <hours, number>, "unitCost": <contractor's hourly cost, number>, "unitPrice": <what to charge the customer per hour, number> },
    { "type": "MATERIAL", "description": "...", "supplier": "supplier name if mentioned, else omit", "quantity": <number>, "unitCost": <contractor's cost, number>, "unitPrice": <price charged to customer, number> }
  ]
}
Rules:
- Create one LABOR line per distinct task mentioned, and one MATERIAL line per distinct material.
- If no price was spoken for an item, put a reasonable market estimate in unitCost and mark unitPrice as unitCost * 1.5.
- If nothing usable was said, return a single LABOR line with description "Could not understand recording — please edit manually" and zero amounts.
- Never include any text outside the JSON object.`;

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

  async process(audio: Buffer, mimeType: string): Promise<VoiceQuoteResult> {
    // Whisper on Workers AI rejects a generic application/octet-stream body
    // with "Invalid input" — it needs the real audio/* content type to know
    // how to decode the recording.
    const whisper = (await this.run(
      "@cf/openai/whisper-large-v3-turbo",
      new Uint8Array(audio),
      mimeType || "audio/webm"
    )) as { result: { text: string } };
    const transcript = whisper.result.text.trim();

    const llm = (await this.run(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      JSON.stringify({
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
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

    const parsed = parseExtractionResponse(rawContent);
    return { transcript, title: parsed.title, lineItems: parsed.lineItems };
  }
}

/** The model's output is free text that should contain one JSON object — pull it out defensively. */
function parseExtractionResponse(raw: string): { title: string; lineItems: ExtractedLineItem[] } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallbackExtraction();
  try {
    const json = JSON.parse(match[0]) as { title?: unknown; lineItems?: unknown };
    if (!Array.isArray(json.lineItems) || json.lineItems.length === 0) return fallbackExtraction();
    const lineItems: ExtractedLineItem[] = json.lineItems
      .filter((li): li is Record<string, unknown> => typeof li === "object" && li !== null)
      .map((li) => ({
        type: li.type === "MATERIAL" ? "MATERIAL" : "LABOR",
        description: typeof li.description === "string" && li.description.trim() ? li.description : "Untitled item",
        supplier: typeof li.supplier === "string" && li.supplier.trim() ? li.supplier : undefined,
        quantity: Number(li.quantity) > 0 ? Number(li.quantity) : 1,
        unitCost: Number(li.unitCost) >= 0 ? Number(li.unitCost) : 0,
        unitPrice: Number(li.unitPrice) >= 0 ? Number(li.unitPrice) : 0,
      }));
    return {
      title: typeof json.title === "string" && json.title.trim() ? json.title.slice(0, 100) : "Voice quote",
      lineItems,
    };
  } catch {
    return fallbackExtraction();
  }
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
