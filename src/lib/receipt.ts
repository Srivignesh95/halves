import "server-only";
import { z } from "zod";

/** What we ask Claude to fill in. Amounts are decimals as printed; we turn them into cents ourselves. */
const TOOL = {
  name: "record_receipt",
  description: "Record everything printed on this receipt.",
  input_schema: {
    type: "object",
    properties: {
      is_receipt: { type: "boolean", description: "false if the image is not a receipt, bill or invoice" },
      merchant: { type: "string", description: "Shop or restaurant name, short" },
      date: { type: "string", description: "Purchase date as YYYY-MM-DD, or empty if not printed" },
      currency: { type: "string", description: "ISO 4217 code, e.g. CAD, USD, INR. Guess from symbols, address and tax names" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Item name, cleaned up and short" },
            quantity: { type: "number" },
            price: { type: "number", description: "Line total for this item (quantity x unit price), after any discount printed for this line" },
            taxed: { type: "boolean", description: "true if tax applies to this line: a tax code letter like H, T, G, P or HST beside it, or the item type is normally taxed. Basic groceries are usually not taxed" },
            tax_codes: { type: "array", items: { type: "string" }, description: "Tax code letters printed beside the line, e.g. ['H'] or ['G','P'], empty if none" },
          },
          required: ["name", "price", "taxed"],
        },
      },
      subtotal: { type: "number", description: "Subtotal before tax, if printed" },
      taxes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "e.g. HST 13%, GST, PST" },
            code: { type: "string", description: "Code letter used beside items for this tax, if any" },
            amount: { type: "number" },
          },
          required: ["label", "amount"],
        },
      },
      discount: { type: "number", description: "Whole-bill discount as a positive number, 0 if none. Do not repeat discounts already folded into item prices" },
      tip: { type: "number", description: "Tip or gratuity, 0 if none" },
      total: { type: "number", description: "Final total paid" },
    },
    required: ["is_receipt", "items", "taxes", "total"],
  },
} as const;

const num = z.number().finite().min(0).max(1_000_000);
const Parsed = z.object({
  is_receipt: z.boolean(),
  merchant: z.string().max(200).optional().default(""),
  date: z.string().max(20).optional().default(""),
  currency: z.string().max(3).optional().default(""),
  items: z.array(z.object({
    name: z.string().max(200),
    quantity: z.number().optional(),
    price: num,
    taxed: z.boolean(),
    tax_codes: z.array(z.string().max(10)).max(5).optional().default([]),
  })).max(150),
  subtotal: num.optional(),
  taxes: z.array(z.object({ label: z.string().max(60), code: z.string().max(10).optional(), amount: num })).max(6),
  discount: num.optional().default(0),
  tip: num.optional().default(0),
  total: num,
});

export type ScannedReceipt = {
  merchant: string;
  date: string;
  currency: string;
  items: { name: string; priceCents: number; taxed: boolean; taxCodes: string[] }[];
  taxes: { label: string; code?: string; amountCents: number }[];
  discountCents: number;
  tipCents: number;
  totalCents: number;
};

const cents = (n: number) => Math.round(n * 100);

export class ReceiptError extends Error {}

/** Send a receipt photo to Claude and get back the items, taxes and total, in cents. */
export async function readReceipt(image: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<ScannedReceipt> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ReceiptError("Receipt scanning isn't set up yet (missing ANTHROPIC_API_KEY).");
  const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");

  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2026-10-21",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.RECEIPT_MODEL || "claude-haiku-5-5",
      max_tokens: 4000,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
          { type: "text", text: "Read this receipt and record it with the tool. Copy amounts exactly as printed. List every purchased line as an item; do not list subtotal, tax, tip, total or payment lines as items. If a line has a discount printed under it, subtract it from that item's price. If the image is not a receipt, set is_receipt to false and leave items empty." },
        ],
      }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    console.error("[receipt] Claude API error", res.status, (await res.text()).slice(0, 500));
    if (res.status === 401) throw new ReceiptError("Receipt scanning is misconfigured (the API key was refused).");
    if (res.status === 429 || res.status === 529) throw new ReceiptError("The receipt reader is busy. Try again in a minute.");
    throw new ReceiptError("Couldn't read the receipt right now. Try again.");
  }
  const body = (await res.json()) as { content?: { type: string; input?: unknown }[] };
  const call = body.content?.find((c) => c.type === "tool_use");
  const parsed = Parsed.safeParse(call?.input);
  if (!parsed.success) {
    console.error("[receipt] unexpected answer", JSON.stringify(call?.input).slice(0, 500));
    throw new ReceiptError("Couldn't make sense of that receipt. Try a clearer photo.");
  }
  const r = parsed.data;
  if (!r.is_receipt) throw new ReceiptError("That doesn't look like a receipt. Try a photo of the whole bill.");
  return {
    merchant: r.merchant.trim().slice(0, 120),
    date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "",
    currency: r.currency.toUpperCase(),
    items: r.items.filter((i) => cents(i.price) > 0).map((i) => ({
      name: (i.quantity && i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name).slice(0, 80),
      priceCents: cents(i.price),
      taxed: i.taxed,
      taxCodes: i.tax_codes.map((c) => c.toUpperCase()),
    })),
    taxes: r.taxes.filter((t) => cents(t.amount) > 0).map((t) => ({ label: t.label.slice(0, 40), code: t.code?.toUpperCase() || undefined, amountCents: cents(t.amount) })),
    discountCents: cents(r.discount),
    tipCents: cents(r.tip),
    totalCents: cents(r.total),
  };
}
