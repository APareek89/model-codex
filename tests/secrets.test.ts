import { describe, expect, it } from "vitest";
import { containsSecret, redactSecrets, redactSecretsDeep } from "../electron/secrets";

describe("secret redaction boundary", () => {
  it("redacts provider-shaped and labeled credentials", () => {
    const input = "hf_abcdefghijklmnopqrstuvwxyz api_key=generic-secret-value";
    expect(redactSecrets(input)).toBe("[redacted] api_key=[redacted]");
    expect(containsSecret(input)).toBe(true);
  });

  it("redacts credentials recursively before durable state writes", () => {
    const value = { messages: [{ content: "authorization: Bearer private-token-value" }], safe: "hello" };
    expect(redactSecretsDeep(value)).toEqual({ messages: [{ content: "authorization: Bearer [redacted]" }], safe: "hello" });
  });
});
