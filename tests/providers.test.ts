import { afterEach, describe, expect, it, vi } from "vitest";
import { completeText, listProviderModels } from "../electron/providers";

afterEach(() => vi.unstubAllGlobals());

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("provider adapters", () => {
  it("loads the live Hugging Face router catalog", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ data: [{ id: "openai/gpt-oss-120b", providers: [{ provider: "groq" }], context_window: 131072 }] }));
    vi.stubGlobal("fetch", fetchMock);
    const models = await listProviderModels("huggingface", "hf_test_value");
    expect(models[0]).toMatchObject({ id: "openai/gpt-oss-120b", contextWindow: 131072 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://router.huggingface.co/v1/models");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer hf_test_value");
  });

  it("filters non-chat OpenAI models and uses stateless Responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ data: [{ id: "text-embedding-3-large", created: 1 }, { id: "gpt-5-test", created: 2 }] }))
      .mockResolvedValueOnce(response({ output: [{ type: "message", content: [{ type: "output_text", text: "hello" }] }] }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await listProviderModels("openai", "sk_test_value")).map((model) => model.id)).toEqual(["gpt-5-test"]);
    expect(await completeText({ provider: "openai", apiKey: "sk_test_value", model: "gpt-5-test", system: "system", messages: [{ role: "user", content: "hi" }] })).toBe("hello");
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.store).toBe(false);
    expect(body.instructions).toBe("system");
  });

  it("maps Anthropic and Google model catalogs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ data: [{ id: "claude-test", display_name: "Claude Test", max_input_tokens: 200000 }] }))
      .mockResolvedValueOnce(response({ models: [
        { name: "models/gemini-test", displayName: "Gemini Test", supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000 },
        { name: "models/embed-test", supportedGenerationMethods: ["embedContent"] },
      ] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await listProviderModels("anthropic", "anthropic_test_value")).toEqual([expect.objectContaining({ id: "claude-test", contextWindow: 200000 })]);
    expect(await listProviderModels("google", "google_test_value")).toEqual([expect.objectContaining({ id: "gemini-test", contextWindow: 1000000 })]);
  });

  it("maps Hugging Face, Anthropic, and Google chat completions", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ choices: [{ message: { content: "hf answer" } }] }))
      .mockResolvedValueOnce(response({ content: [{ type: "text", text: "claude answer" }] }))
      .mockResolvedValueOnce(response({ candidates: [{ content: { parts: [{ text: "gemini answer" }] } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const base = { apiKey: "fixture-provider-value", system: "system", messages: [{ role: "user" as const, content: "hello" }] };
    await expect(completeText({ ...base, provider: "huggingface", model: "hf-model" })).resolves.toBe("hf answer");
    await expect(completeText({ ...base, provider: "anthropic", model: "claude-model" })).resolves.toBe("claude answer");
    await expect(completeText({ ...base, provider: "google", model: "gemini-model" })).resolves.toBe("gemini answer");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(4096);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).system).toBe("system");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).systemInstruction.parts[0].text).toBe("system");
  });

  it("redacts credential-shaped strings from provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { message: "bad key sk-test-secret-value" } }, 401)));
    await expect(listProviderModels("openai", "sk-test-secret-value")).rejects.not.toThrow("sk-test-secret-value");
  });
});
