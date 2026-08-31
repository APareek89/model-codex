import { afterEach, describe, expect, it, vi } from "vitest";

const completeText = vi.hoisted(() => vi.fn());
vi.mock("../electron/providers", () => ({ completeText }));

import { runAgentChat, synthesizeConnector } from "../electron/agent-runtime";

function request() {
  return {
    provider: "anthropic" as const,
    apiKey: "fixture-provider-value",
    model: "claude-fixture",
    conversationId: "conversation-1",
    prompt: "Give a short answer",
    messages: [],
    memoryEnabled: false,
    builder: { id: "builder", name: "Builder", systemPrompt: "Build well", tools: [], documents: [] },
    attachments: [],
    connectors: [],
    connectorSecrets: {},
  };
}

afterEach(() => completeText.mockReset());

describe("agent runtime", () => {
  it("returns a builder answer without optional extra calls", async () => {
    completeText.mockResolvedValueOnce("Builder answer");
    await expect(runAgentChat(request())).resolves.toMatchObject({ content: "Builder answer", model: "claude-fixture" });
    expect(completeText).toHaveBeenCalledTimes(1);
  });

  it("runs builder, reviewer, and constraint-preserving revision in separate passes", async () => {
    completeText
      .mockResolvedValueOnce("Draft")
      .mockResolvedValueOnce("Material critique")
      .mockResolvedValueOnce("Revised answer");
    const result = await runAgentChat({
      ...request(),
      reviewer: { id: "reviewer", name: "Vera", systemPrompt: "Review materially", tools: [], documents: [] },
    });
    expect(result.content).toBe("Revised answer");
    expect(result.trace).toEqual([expect.objectContaining({ name: "Vera", status: "complete" })]);
    expect(completeText).toHaveBeenCalledTimes(3);
    expect(completeText.mock.calls[2][0].messages[0].content).toContain("Material critique");
  });

  it("turns model-generated API documentation into an unapproved manifest", async () => {
    completeText.mockResolvedValueOnce(JSON.stringify({
      description: "Read analytics events",
      baseUrl: "https://api.example.com/",
      fields: [{ id: "api_key", label: "API key", secret: true, required: true, location: "header", key: "Authorization", prefix: "Bearer " }],
      operations: [{ id: "list_events", name: "List events", description: "List events", method: "GET", path: "v1/events", parameters: [] }],
    }));
    const connector = await synthesizeConnector({
      provider: "anthropic",
      apiKey: "fixture-provider-value",
      model: "claude-fixture",
      name: "Analytics",
      baseUrl: "https://api.example.com/",
      documentation: "GET /v1/events",
    });
    expect(connector).toMatchObject({ name: "Analytics", status: "draft", baseUrl: "https://api.example.com/" });
    expect(connector.operations).toHaveLength(1);
  });
});
