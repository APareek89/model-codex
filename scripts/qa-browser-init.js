/* global window */
(() => {
  let savedState = {
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

  const catalogs = {
    huggingface: [
      { id: "mock/hf-instruct", name: "HF Instruct Mock", detail: "QA model", contextWindow: 8192 },
      { id: "mock/hf-chat", name: "HF Chat Mock", detail: "QA model", contextWindow: 32768 },
    ],
    anthropic: [
      { id: "claude-mock", name: "Claude Mock", detail: "QA model", contextWindow: 200000 },
    ],
    openai: [{ id: "gpt-mock", name: "GPT Mock", detail: "QA model" }],
    google: [{ id: "gemini-mock", name: "Gemini Mock", detail: "QA model" }],
  };

  window.modelCodex = {
    getAppInfo: async () => ({ version: "0.2.1-qa", platform: "darwin", arch: "arm64" }),
    loadState: async () => structuredClone(savedState),
    saveState: async (state) => {
      savedState = structuredClone(state);
      return structuredClone(savedState);
    },
    chooseTextFiles: async () => [{ id: "qa-file", name: "qa.txt", size: 11, content: "QA evidence" }],
    listModels: async (provider, apiKey) => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (apiKey === "hf-fail") throw new Error("QA: Hugging Face rejected this token.");
      return structuredClone(catalogs[provider] ?? []);
    },
    runChat: async (request) => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (request.apiKey === "send-fail") throw new Error("QA: provider request failed.");
      const trace = [{ id: crypto.randomUUID(), name: "qa_provider", status: "complete", detail: "Mock provider completed" }];
      if (request.reviewer) trace.push({ id: crypto.randomUUID(), name: request.reviewer.name, status: "complete", detail: "Mock reviewer completed" });
      if (request.memoryEnabled) trace.push({ id: crypto.randomUUID(), name: "memory_compaction", status: "complete", detail: "Mock memory checkpoint completed" });
      return {
        content: `QA response from ${request.provider}/${request.model}: ${request.prompt}`,
        model: request.model,
        trace,
      };
    },
    synthesizeConnector: async (request) => ({
      id: `connector-${crypto.randomUUID()}`,
      name: request.name,
      description: "QA analytics connector",
      baseUrl: request.baseUrl || "https://api.example.com/",
      status: "draft",
      documentation: request.documentation,
      fields: [{ id: "api_key", label: "API key", secret: true, required: true, location: "header", key: "Authorization", prefix: "Bearer " }],
      operations: [{ id: "list_events", name: "List events", description: "Read analytics events", method: "GET", path: "v1/events", parameters: [] }],
    }),
    openExternal: async () => undefined,
  };
})();
