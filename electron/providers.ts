import type { ProviderId, ProviderModel } from "../src/types.js";
import { redactSecrets } from "./secrets.js";

export type ProviderTurn = { role: "user" | "assistant"; content: string };

export type CompletionInput = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  system: string;
  messages: ProviderTurn[];
  maxTokens?: number;
};

const TIMEOUT_MS = 180_000;

function sanitized(message: string) {
  return redactSecrets(message)
    .replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 1_200);
}

async function requestJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: unknown = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
    if (!response.ok) {
      const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
      const nested = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : {};
      const message = nested.message ?? record.message ?? record.error ?? `${response.status} ${response.statusText}`;
      throw new Error(sanitized(String(message)));
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The provider request timed out.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function bearer(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

function modelLabel(id: string) {
  return id.replace(/^models\//, "").replace(/[-_/]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function modelItems(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

export async function listProviderModels(provider: ProviderId, apiKey: string): Promise<ProviderModel[]> {
  if (!apiKey.trim()) throw new Error("Add an API key or token first.");

  if (provider === "huggingface") {
    const body = await requestJson("https://router.huggingface.co/v1/models", { headers: bearer(apiKey) });
    return modelItems(body.data).map((item) => {
      const id = String(item.id ?? "");
      const providers = modelItems(item.providers);
      const contextWindow = typeof item.context_window === "number" ? item.context_window : undefined;
      return {
        id,
        name: modelLabel(id),
        detail: providers.length ? `${providers.length} inference provider${providers.length === 1 ? "" : "s"}` : "HF Inference Provider",
        contextWindow,
      };
    }).filter((item) => item.id);
  }

  if (provider === "openai") {
    const body = await requestJson("https://api.openai.com/v1/models", { headers: bearer(apiKey) });
    const blocked = /embedding|whisper|tts|transcrib|moderation|dall-e|image|realtime|audio/i;
    return modelItems(body.data)
      .map((item) => ({ id: String(item.id ?? ""), created: typeof item.created === "number" ? item.created : undefined }))
      .filter((item) => item.id && !blocked.test(item.id))
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
      .map((item) => ({ id: item.id, name: modelLabel(item.id), detail: "OpenAI API model", createdAt: item.created ? new Date(item.created * 1_000).toISOString() : undefined }));
  }

  if (provider === "anthropic") {
    const body = await requestJson("https://api.anthropic.com/v1/models?limit=1000", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    });
    return modelItems(body.data).map((item) => {
      const id = String(item.id ?? "");
      return {
        id,
        name: String(item.display_name ?? modelLabel(id)),
        detail: typeof item.max_input_tokens === "number" ? `${item.max_input_tokens.toLocaleString()} token context` : "Claude API model",
        createdAt: typeof item.created_at === "string" ? item.created_at : undefined,
        contextWindow: typeof item.max_input_tokens === "number" ? item.max_input_tokens : undefined,
      };
    }).filter((item) => item.id);
  }

  const body = await requestJson("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
  });
  return modelItems(body.models)
    .filter((item) => Array.isArray(item.supportedGenerationMethods) && item.supportedGenerationMethods.includes("generateContent"))
    .map((item) => {
      const id = String(item.name ?? "").replace(/^models\//, "");
      return {
        id,
        name: String(item.displayName ?? modelLabel(id)),
        detail: typeof item.description === "string" ? item.description.slice(0, 160) : "Gemini API model",
        contextWindow: typeof item.inputTokenLimit === "number" ? item.inputTokenLimit : undefined,
      };
    }).filter((item) => item.id);
}

function textFromOpenAiResponse(body: Record<string, unknown>) {
  if (typeof body.output_text === "string") return body.output_text;
  for (const item of modelItems(body.output)) {
    if (item.type !== "message") continue;
    for (const content of modelItems(item.content)) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

export async function completeText(input: CompletionInput): Promise<string> {
  const maxTokens = Math.max(256, Math.min(input.maxTokens ?? 4_096, 16_384));

  if (input.provider === "openai") {
    const body = await requestJson("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: bearer(input.apiKey),
      body: JSON.stringify({
        model: input.model,
        instructions: input.system,
        input: input.messages,
        max_output_tokens: maxTokens,
        store: false,
      }),
    });
    const text = textFromOpenAiResponse(body);
    if (!text) throw new Error("OpenAI returned no text content for this model.");
    return text;
  }

  if (input.provider === "huggingface") {
    const body = await requestJson("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: bearer(input.apiKey),
      body: JSON.stringify({
        model: input.model,
        messages: input.system ? [{ role: "system", content: input.system }, ...input.messages] : input.messages,
        max_tokens: maxTokens,
        stream: false,
      }),
    });
    const choice = modelItems(body.choices)[0];
    const message = choice?.message && typeof choice.message === "object" ? choice.message as Record<string, unknown> : {};
    if (typeof message.content !== "string" || !message.content) throw new Error("Hugging Face returned no text content for this model.");
    return message.content;
  }

  if (input.provider === "anthropic") {
    const body = await requestJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": input.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model, system: input.system, messages: input.messages, max_tokens: maxTokens, stream: false }),
    });
    const text = modelItems(body.content).filter((item) => item.type === "text" && typeof item.text === "string").map((item) => String(item.text)).join("\n");
    if (!text) throw new Error("Anthropic returned no text content for this model.");
    return text;
  }

  const model = encodeURIComponent(input.model.replace(/^models\//, ""));
  const body = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": input.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: input.system ? { parts: [{ text: input.system }] } : undefined,
      contents: input.messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  const candidate = modelItems(body.candidates)[0];
  const content = candidate?.content && typeof candidate.content === "object" ? candidate.content as Record<string, unknown> : {};
  const text = modelItems(content.parts).filter((part) => typeof part.text === "string").map((part) => String(part.text)).join("\n");
  if (!text) throw new Error("Google returned no text content for this model.");
  return text;
}
