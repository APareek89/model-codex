import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const mocks = vi.hoisted(() => ({
  completeText: vi.fn(),
  userData: `${process.env.TMPDIR || "/tmp"}/model-codex-memory-vitest-${process.pid}`,
}));

vi.mock("electron", () => ({ app: { getPath: () => mocks.userData } }));
vi.mock("../electron/providers", () => ({ completeText: mocks.completeText }));

import { appendRawTurn, compileMemory, retrieveLongTermMemory } from "../electron/memory";

beforeEach(async () => {
  mocks.completeText.mockReset();
  await rm(mocks.userData, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(mocks.userData, { recursive: true, force: true });
});

function turns(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? "user" as const : "assistant" as const,
    content: index === 0 ? "The launch region is India." : `Turn ${index}`,
  }));
}

describe("local memory harness", () => {
  it("redacts provider-shaped credentials before the raw journal is written", async () => {
    await appendRawTurn("conversation", "token hf_abcdefghijklmnopqrstuvwxyz", "acknowledged");
    const raw = await readFile(path.join(mocks.userData, "memory", "raw", "conversation.jsonl"), "utf8");
    expect(raw).not.toContain("hf_abcdefghijklmnopqrstuvwxyz");
    expect(raw).toContain("[redacted]");
  });

  it("publishes only evidence-backed durable facts at the periodic boundary", async () => {
    mocks.completeText.mockResolvedValueOnce(JSON.stringify({
      summary: "The project targets India.",
      facts: [{ slug: "launch-region", title: "Launch region", category: "decision", content: "The launch region is India.", evidence: "The launch region is India." }],
    }));
    const result = await compileMemory({
      provider: "anthropic",
      apiKey: "fixture-provider-value",
      model: "claude-fixture",
      conversationId: "conversation",
      messages: turns(6),
    });
    expect(result).toEqual({ compiled: true });
    await expect(retrieveLongTermMemory("India launch")).resolves.toContain("The launch region is India.");
  });

  it("writes an immutable checkpoint and retains a ten-message increment", async () => {
    mocks.completeText.mockResolvedValueOnce(JSON.stringify({ summary: "Checkpoint summary", facts: [] }));
    const result = await compileMemory({
      provider: "anthropic",
      apiKey: "fixture-provider-value",
      model: "claude-fixture",
      conversationId: "conversation",
      messages: turns(20),
    });
    expect(result).toMatchObject({ compiled: true, summary: "Checkpoint summary", compactedThrough: 10 });
    const checkpoints = await readdir(path.join(mocks.userData, "memory", "checkpoints", "conversation"));
    expect(checkpoints).toHaveLength(1);
  });
});
