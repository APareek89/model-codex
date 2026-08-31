import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const messageSchema = z.object({
  id: z.string().max(120),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(500_000),
  createdAt: z.number().int().nonnegative(),
  agentId: z.string().max(120).optional(),
  model: z.string().max(240).optional(),
  trace: z.array(z.object({
    id: z.string().max(120),
    name: z.string().max(160),
    status: z.enum(["running", "complete", "error"]),
    detail: z.string().max(2_000),
  })).max(100).optional(),
});

const conversationSchema = z.object({
  id: z.string().max(120),
  title: z.string().max(180),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  messages: z.array(messageSchema).max(2_000),
  summary: z.string().max(100_000).optional(),
  compactedThrough: z.number().int().nonnegative().optional(),
});

const agentSchema = z.object({
  id: z.string().max(120),
  name: z.string().max(120),
  role: z.string().max(180),
  mode: z.enum(["builder", "reviewer"]),
  description: z.string().max(1_000),
  systemPrompt: z.string().max(100_000),
  source: z.enum(["council", "custom"]),
  readOnly: z.boolean().optional(),
  tools: z.array(z.string().max(80)).max(50),
  documents: z.array(z.object({
    id: z.string().max(120),
    name: z.string().max(260),
    size: z.number().int().nonnegative(),
    content: z.string().max(2_000_000),
  })).max(25),
});

const connectorSchema = z.object({
  id: z.string().max(120),
  name: z.string().max(120),
  description: z.string().max(1_000),
  baseUrl: z.string().max(2_000),
  status: z.enum(["draft", "ready"]),
  documentation: z.string().max(300_000),
  fields: z.array(z.object({
    id: z.string().max(120),
    label: z.string().max(120),
    secret: z.boolean(),
    required: z.boolean(),
    location: z.enum(["header", "query"]),
    key: z.string().max(160),
    prefix: z.string().max(120).optional(),
  })).max(50),
  operations: z.array(z.object({
    id: z.string().max(120),
    name: z.string().max(160),
    description: z.string().max(1_000),
    method: z.enum(["GET", "POST"]),
    path: z.string().max(2_000),
    parameters: z.array(z.object({
      id: z.string().max(120),
      label: z.string().max(160),
      location: z.enum(["path", "query", "body"]),
      required: z.boolean(),
    })).max(50),
  })).max(100),
});

export const persistedStateSchema = z.object({
  version: z.literal(2),
  conversations: z.array(conversationSchema).max(200),
  agents: z.array(agentSchema).max(100),
  connectors: z.array(connectorSchema).max(100),
  preferences: z.object({
    activeConversationId: z.string().max(120).nullable(),
    activeAgentId: z.string().max(120).nullable(),
    reviewerAgentId: z.string().max(120).nullable(),
    sidebarCollapsed: z.boolean(),
    selectedProvider: z.enum(["huggingface", "openai", "anthropic", "google"]).nullable(),
    selectedModelId: z.string().max(300).nullable(),
    memoryEnabled: z.boolean(),
  }),
});

export type PersistedState = z.infer<typeof persistedStateSchema>;

export const EMPTY_STATE: PersistedState = {
  version: 2,
  conversations: [],
  agents: [],
  connectors: [],
  preferences: {
    activeConversationId: null,
    activeAgentId: null,
    reviewerAgentId: null,
    sidebarCollapsed: false,
    selectedProvider: null,
    selectedModelId: null,
    memoryEnabled: true,
  },
};

function statePath() {
  return path.join(app.getPath("userData"), "workspace-state.json");
}

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await readFile(statePath(), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version === 1) {
      const preferences = parsed.preferences && typeof parsed.preferences === "object" ? parsed.preferences as Record<string, unknown> : {};
      const connectors = Array.isArray(parsed.connectors) ? parsed.connectors.map((value) => {
        const connector = value && typeof value === "object" ? value as Record<string, unknown> : {};
        const fields = Array.isArray(connector.fields) ? connector.fields.map((fieldValue) => {
          const field = fieldValue && typeof fieldValue === "object" ? fieldValue as Record<string, unknown> : {};
          return { ...field, location: "header", key: field.id === "api_key" ? "Authorization" : String(field.id ?? "X-API-Key"), prefix: field.id === "api_key" ? "Bearer " : undefined };
        }) : [];
        return { ...connector, fields, operations: [] };
      }) : [];
      return persistedStateSchema.parse({
        ...parsed,
        version: 2,
        connectors,
        preferences: { ...preferences, selectedProvider: null, selectedModelId: null, memoryEnabled: true },
      });
    }
    return persistedStateSchema.parse(parsed);
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveState(input: unknown): Promise<PersistedState> {
  const state = persistedStateSchema.parse(input);
  const destination = statePath();
  const temp = `${destination}.tmp`;
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temp, destination);
  return state;
}
