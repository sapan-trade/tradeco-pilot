import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { loadHsCatalog, type HsEntry } from "@/server/integrations/hts";

export interface AiClassificationInput {
  skuId: string;
  title: string;
  description: string | null;
  materials: unknown;
  supplierCountry: string | null;
  imageUrls?: string[];
}

export interface AiClassificationResult {
  hsCode: string;
  confidence: number;
  rationale: string;
  modelVersion: string;
}

const STUB_MODEL_VERSION = "stub-v0";
const REAL_MODEL = "claude-sonnet-4-6";

/**
 * Picks real Claude or the deterministic stub based on env.
 *
 * Real path requires BOTH `USE_REAL_AI=1` AND `ANTHROPIC_API_KEY` set.
 * Tests (NODE_ENV=test) always use the stub regardless of env so the suite
 * stays free + deterministic.
 */
export async function generateHsCode(
  input: AiClassificationInput
): Promise<AiClassificationResult> {
  const useReal =
    process.env.NODE_ENV !== "test" &&
    process.env.USE_REAL_AI === "1" &&
    !!process.env.ANTHROPIC_API_KEY;

  if (useReal) {
    try {
      return await callClaude(input);
    } catch (err) {
      console.error("[ai] real Claude call failed, falling back to stub:", err);
      return deterministicClassify(input);
    }
  }
  return deterministicClassify(input);
}

export function hashInput(input: AiClassificationInput): string {
  const canonical = JSON.stringify({
    title: input.title,
    description: input.description,
    materials: input.materials,
    supplierCountry: input.supplierCountry,
    imageUrls: input.imageUrls ?? [],
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

// -------------------- Real Claude path --------------------

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

const CLASSIFY_TOOL = {
  name: "submit_hs_classification",
  description:
    "Submit your final harmonized-system (HS) classification for the product. " +
    "You MUST always call this tool exactly once with your best answer.",
  input_schema: {
    type: "object" as const,
    properties: {
      hsCode: {
        type: "string" as const,
        description: "Destination-country 10-digit HS code, formatted as XXXX.XX.XXXX",
        pattern: "^\\d{4}\\.\\d{2}\\.\\d{4}$",
      },
      confidence: {
        type: "number" as const,
        description: "Your confidence in this classification, 0.0–1.0",
        minimum: 0,
        maximum: 1,
      },
      rationale: {
        type: "string" as const,
        description:
          "1–3 sentences explaining which HS chapter / heading / sub-heading rules apply " +
          "and what product attributes drove the decision.",
      },
    },
    required: ["hsCode", "confidence", "rationale"],
  },
};

async function callClaude(input: AiClassificationInput): Promise<AiClassificationResult> {
  const catalog = loadHsCatalog();
  const systemPrompt = buildSystemPrompt(catalog);
  const userContent = buildUserContent(input);

  const response = await getClient().messages.create({
    model: REAL_MODEL,
    max_tokens: 512,
    // System prompt is sent with cache_control so the HTS reference + instructions
    // are reused across SKUs in the same 5-minute window (90% off on cached tokens).
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: CLASSIFY_TOOL.name },
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Anthropic response did not include the expected tool_use block");
  }
  const data = toolUse.input as { hsCode: string; confidence: number; rationale: string };

  return {
    hsCode: data.hsCode,
    confidence: clamp(data.confidence, 0, 1),
    rationale: data.rationale,
    modelVersion: response.model,
  };
}

function buildSystemPrompt(catalog: HsEntry[]): string {
  return [
    "You are a licensed customs broker classifying products to 10-digit HS codes.",
    "Use the General Rules of Interpretation (GRI 1–6) and the destination country's tariff schedule.",
    "Prefer specific subheadings over generic ones. Be conservative on confidence when:",
    "- material composition is ambiguous,",
    "- the product could fall under multiple chapters,",
    "- destination-specific subheadings are not in the reference catalog.",
    "",
    "Reference HS catalog (subset — extend with your trade-classification training where the catalog is silent):",
    catalog.map((e) => `  ${e.hs}  (ch ${e.chapter})  ${e.title}`).join("\n"),
    "",
    "When you classify, ALWAYS call the `submit_hs_classification` tool. Never reply in plain text.",
  ].join("\n");
}

function buildUserContent(input: AiClassificationInput): Anthropic.MessageParam["content"] {
  const blocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
  const materialsText = stringifyMaterials(input.materials);
  blocks.push({
    type: "text",
    text:
      `Product to classify:\n` +
      `  Title: ${input.title}\n` +
      `  Description: ${input.description ?? "(none)"}\n` +
      `  Materials: ${materialsText || "(unspecified)"}\n` +
      `  Supplier country: ${input.supplierCountry ?? "(unspecified)"}\n` +
      `  Destination country: US\n` +
      (input.imageUrls && input.imageUrls.length > 0
        ? `  Reference images: ${input.imageUrls.length} attached\n`
        : ""),
  });
  for (const url of input.imageUrls ?? []) {
    blocks.push({
      type: "image",
      source: { type: "url", url },
    });
  }
  return blocks;
}

// -------------------- Deterministic stub (tests + fallback) --------------------

function deterministicClassify(input: AiClassificationInput): AiClassificationResult {
  const catalog = loadHsCatalog();
  const text = [
    input.title,
    input.description ?? "",
    stringifyMaterials(input.materials),
    (input.imageUrls ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const tokens = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));

  let best: HsEntry = catalog[0];
  let bestScore = -1;
  let bestMatches: string[] = [];

  for (const entry of catalog) {
    const matches = entry.keywords.filter((k) => tokens.has(k));
    if (matches.length > bestScore) {
      best = entry;
      bestScore = matches.length;
      bestMatches = matches;
    }
  }

  const seedStr = [input.skuId, input.title, (input.imageUrls ?? []).join("|")].join("|");
  const seed = fnv1a(seedStr);
  const jitter = (seed % 100) / 1000;
  const imageBonus = (input.imageUrls?.length ?? 0) > 0 ? 0.03 : 0;
  const base = bestScore > 0 ? 0.7 + Math.min(bestScore, 3) * 0.07 : 0.55;
  const confidence = clamp(base + jitter + imageBonus, 0.01, 0.99);

  const rationale =
    bestScore > 0
      ? `Matched keywords [${bestMatches.join(", ")}] against HS title "${best.title}" (chapter ${best.chapter})` +
        ((input.imageUrls?.length ?? 0) > 0 ? `; image inputs contributed.` : ".")
      : `No keyword match; defaulted to first catalog entry "${best.title}".`;

  return {
    hsCode: best.hs,
    confidence: Number(confidence.toFixed(4)),
    rationale,
    modelVersion: STUB_MODEL_VERSION,
  };
}

function stringifyMaterials(m: unknown): string {
  if (!m) return "";
  if (Array.isArray(m)) {
    return m
      .map((row: any) => (row && typeof row === "object" ? row.material ?? "" : String(row)))
      .join(" ");
  }
  return JSON.stringify(m);
}

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
