export type ProviderId = "huggingface" | "openai" | "anthropic" | "google";
export type AgentMode = "builder" | "reviewer";
export type ViewId = "chat" | "agents" | "model" | "external-apis";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  agentId?: string;
  model?: string;
  trace?: ToolTrace[];
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  summary?: string;
  compactedThrough?: number;
};

export type AgentDocument = { id: string; name: string; size: number; content: string };

export type AgentDefinition = {
  id: string;
  name: string;
  role: string;
  mode: AgentMode;
  description: string;
  systemPrompt: string;
  source: "council" | "custom";
  readOnly?: boolean;
  tools: string[];
  documents: AgentDocument[];
};

export type ConnectorField = {
  id: string;
  label: string;
  secret: boolean;
  required: boolean;
  location: "header" | "query";
  key: string;
  prefix?: string;
};

export type ConnectorParameter = {
  id: string;
  label: string;
  location: "path" | "query" | "body";
  required: boolean;
};

export type ConnectorOperation = {
  id: string;
  name: string;
  description: string;
  method: "GET" | "POST";
  path: string;
  parameters: ConnectorParameter[];
};

export type ConnectorDefinition = {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  status: "draft" | "ready";
  documentation: string;
  fields: ConnectorField[];
  operations: ConnectorOperation[];
};

export type ProviderModel = {
  id: string;
  name: string;
  detail?: string;
  createdAt?: string;
  contextWindow?: number;
};

export type ToolTrace = {
  id: string;
  name: string;
  status: "running" | "complete" | "error";
  detail: string;
};

export type ChatAttachment = AgentDocument;

export type RunChatRequest = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  conversationId: string;
  prompt: string;
  messages: Array<Pick<Message, "role" | "content">>;
  conversationSummary?: string;
  compactedThrough?: number;
  memoryEnabled: boolean;
  builder: Pick<AgentDefinition, "id" | "name" | "systemPrompt" | "tools" | "documents">;
  reviewer?: Pick<AgentDefinition, "id" | "name" | "systemPrompt" | "tools" | "documents">;
  attachments: ChatAttachment[];
  connectors: ConnectorDefinition[];
  connectorSecrets: Record<string, Record<string, string>>;
};

export type RunChatResponse = {
  content: string;
  model: string;
  trace: ToolTrace[];
  summary?: string;
  compactedThrough?: number;
};

export type SynthesizeConnectorRequest = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  name: string;
  baseUrl: string;
  documentation: string;
};

export type PersistedState = {
  version: 2;
  conversations: Conversation[];
  agents: AgentDefinition[];
  connectors: ConnectorDefinition[];
  preferences: {
    activeConversationId: string | null;
    activeAgentId: string | null;
    reviewerAgentId: string | null;
    sidebarCollapsed: boolean;
    selectedProvider: ProviderId | null;
    selectedModelId: string | null;
    memoryEnabled: boolean;
  };
};

export type AppInfo = { version: string; platform: string; arch: string };

export type DesktopApi = {
  getAppInfo(): Promise<AppInfo>;
  loadState(): Promise<PersistedState>;
  saveState(state: PersistedState): Promise<PersistedState>;
  chooseTextFiles(): Promise<AgentDocument[]>;
  listModels(provider: ProviderId, apiKey: string): Promise<ProviderModel[]>;
  runChat(request: RunChatRequest): Promise<RunChatResponse>;
  synthesizeConnector(request: SynthesizeConnectorRequest): Promise<ConnectorDefinition>;
  openExternal(url: string): Promise<void>;
};
