import { app } from "electron";
import { appendFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ProviderId } from "../src/types.js";
import { completeText, type ProviderTurn } from "./providers.js";

const factSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  category: z.enum(["preference", "project", "decision", "constraint", "person", "workflow", "fact"]),
  content: z.string().min(1).max(2_000),
  evidence: z.string().min(1).max(600),
});

const compilationSchema = z.object({
  summary: z.string().min(1).max(12_000),
  facts: z.array(factSchema).max(12),
});

type MemoryCompileInput = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  conversationId: string;
  messages: ProviderTurn[];
  existingSummary?: string;
  compactedThrough?: number;
};

function root() {
  return path.join(app.getPath("userData"), "memory");
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "conversation";
}

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "memory";
}

function redactSecrets(value: string) {
  return value
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/hf_[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/AIza[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, "$1[redacted]");
}

function containsSecret(value: string) {
  return redactSecrets(value) !== value || /\b(api[-_ ]?key|access[-_ ]?token|client[-_ ]?secret)\s*[:=]\s*\S{8,}/i.test(value);
}

async function atomicWrite(destination: string, content: string) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temp = `${destination}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, content, { encoding: "utf8", mode: 0o600 });
  await rename(temp, destination);
}

function terms(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
}

export async function retrieveLongTermMemory(query: string) {
  const wiki = path.join(root(), "wiki");
  await mkdir(wiki, { recursive: true });
  const queryTerms = terms(query);
  const entries = await readdir(wiki, { withFileTypes: true });
  const scored: Array<{ score: number; text: string }> = [];
  for (const entry of entries.slice(0, 400)) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const text = await readFile(path.join(wiki, entry.name), "utf8");
    const docTerms = terms(text);
    let score = 0;
    for (const term of queryTerms) if (docTerms.has(term)) score += 1;
    if (score) scored.push({ score, text });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 5).map((item) => item.text.slice(0, 4_000)).join("\n\n---\n\n");
}

export async function appendRawTurn(conversationId: string, user: string, assistant: string) {
  const rawDir = path.join(root(), "raw");
  await mkdir(rawDir, { recursive: true });
  const entry = JSON.stringify({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), user: redactSecrets(user), assistant: redactSecrets(assistant) });
  await appendFile(path.join(rawDir, `${safeId(conversationId)}.jsonl`), `${entry}\n`, { encoding: "utf8", mode: 0o600 });
}

function parseCompilation(text: string) {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Memory compiler did not return JSON.");
  return compilationSchema.parse(JSON.parse(stripped.slice(start, end + 1)));
}

async function rebuildIndex() {
  const wiki = path.join(root(), "wiki");
  const entries = await readdir(wiki, { withFileTypes: true });
  const index: Record<string, string[]> = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const text = await readFile(path.join(wiki, entry.name), "utf8");
    for (const term of terms(text)) {
      const bucket = index[term] ?? [];
      if (bucket.length < 50) bucket.push(entry.name);
      index[term] = bucket;
    }
  }
  await atomicWrite(path.join(root(), "index.json"), `${JSON.stringify({ version: 1, rebuiltAt: new Date().toISOString(), terms: index }, null, 2)}\n`);
}

async function publishFacts(conversationId: string, transcript: string, facts: z.infer<typeof factSchema>[]) {
  const published: string[] = [];
  for (const fact of facts) {
    if (containsSecret(fact.content) || containsSecret(fact.evidence)) continue;
    if (!transcript.includes(fact.evidence)) continue;
    const slug = safeSlug(fact.slug);
    const destination = path.join(root(), "wiki", `${slug}.md`);
    let previous = "";
    try { previous = await readFile(destination, "utf8"); } catch { /* first publication */ }
    const update = `## ${new Date().toISOString()}\n\n${fact.content}\n\n- Category: ${fact.category}\n- Evidence: “${fact.evidence.replace(/\n/g, " ")}”\n- Conversation: ${safeId(conversationId)}\n`;
    const content = previous
      ? `${previous.trim()}\n\n${update}`.slice(-180_000)
      : `# ${fact.title}\n\n${update}`;
    await atomicWrite(destination, `${content.trim()}\n`);
    published.push(slug);
  }
  if (published.length) await rebuildIndex();
  return published;
}

export async function compileMemory(input: MemoryCompileInput) {
  const messageCount = input.messages.length;
  const needsCompaction = messageCount > 18 && messageCount - (input.compactedThrough ?? 0) >= 6;
  const periodicCompile = messageCount >= 6 && messageCount % 6 === 0;
  if (!needsCompaction && !periodicCompile) return {};

  const transcript = input.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n").slice(-70_000);
  const compilerPrompt = `Compile this conversation into local memory. Return JSON only with this schema:
{"summary":"a compact conversational checkpoint preserving objective, decisions, constraints, unresolved work, and important evidence","facts":[{"slug":"stable-kebab-case","title":"page title","category":"preference|project|decision|constraint|person|workflow|fact","content":"durable fact only","evidence":"an exact contiguous quote copied from the transcript"}]}

Rules:
- The summary may synthesize, but every durable fact needs an exact evidence quote present verbatim below.
- Exclude passwords, API keys, access tokens, authentication headers, transient chatter, and guesses.
- Include at most 12 durable facts. Use an empty facts array when nothing deserves long-term memory.
- Preserve the user's binding constraints and pending work in the summary.

Previous checkpoint:
${input.existingSummary || "none"}

Transcript:
${transcript}`;

  const raw = await completeText({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    system: "You are a conservative local-memory compiler. Never copy credentials. Emit valid JSON only.",
    messages: [{ role: "user", content: compilerPrompt }],
    maxTokens: 3_000,
  });
  const compilation = parseCompilation(raw);
  const published = await publishFacts(input.conversationId, transcript, compilation.facts);

  if (needsCompaction) {
    const checkpoint = {
      version: 1,
      conversationId: input.conversationId,
      createdAt: new Date().toISOString(),
      compactedThrough: messageCount,
      summary: redactSecrets(compilation.summary),
      published,
    };
    const destination = path.join(root(), "checkpoints", safeId(input.conversationId), `${Date.now()}-${crypto.randomUUID()}.json`);
    await atomicWrite(destination, `${JSON.stringify(checkpoint, null, 2)}\n`);
    return { summary: redactSecrets(compilation.summary), compactedThrough: messageCount };
  }
  return {};
}
