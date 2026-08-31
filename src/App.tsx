import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon, type IconName } from "./components/Icon";
import { cloneCouncilTemplates } from "./data/agent-templates";
import type {
  AgentDefinition,
  AgentMode,
  ChatAttachment,
  ConnectorDefinition,
  Conversation,
  PersistedState,
  ProviderId,
  ProviderModel,
  ViewId,
} from "./types";

const PROVIDERS: Array<{ id: ProviderId; name: string; detail: string; placeholder: string }> = [
  { id: "huggingface", name: "Hugging Face", detail: "Open model router", placeholder: "hf_••••••••••••••••" },
  { id: "openai", name: "OpenAI", detail: "GPT and reasoning models", placeholder: "sk-••••••••••••••••" },
  { id: "anthropic", name: "Anthropic", detail: "Claude models", placeholder: "sk-ant-••••••••••" },
  { id: "google", name: "Google", detail: "Gemini models", placeholder: "AIza••••••••••••" },
];

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: IconName }> = [
  { id: "chat", label: "New chat", icon: "new" },
  { id: "agents", label: "Agents", icon: "agent" },
  { id: "model", label: "Model", icon: "model" },
  { id: "external-apis", label: "External APIs", icon: "api" },
];

const suggestions = [
  { icon: "search" as IconName, tone: "blue", title: "Explore and understand", detail: "Research a market, repo, or complex topic" },
  { icon: "tools" as IconName, tone: "purple", title: "Build something new", detail: "Create a feature, app, analysis, or tool" },
  { icon: "history" as IconName, tone: "green", title: "Review and improve", detail: "Ask a selected reviewer to sharpen the output" },
  { icon: "spark" as IconName, tone: "orange", title: "Fix issues and failures", detail: "Debug with files, web evidence, and Python" },
];

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function freshState(): PersistedState {
  const now = Date.now();
  const conversations: Conversation[] = [
    { id: "welcome", title: "Build Model Codex desktop", createdAt: now, updatedAt: now, messages: [] },
    { id: "memory", title: "Design the memory harness", createdAt: now - 60_000, updatedAt: now - 60_000, messages: [] },
    { id: "agents", title: "Configure the Agent Council", createdAt: now - 120_000, updatedAt: now - 120_000, messages: [] },
  ];
  return {
    version: 2,
    conversations,
    agents: cloneCouncilTemplates(),
    connectors: [],
    preferences: {
      activeConversationId: conversations[0].id,
      activeAgentId: "council-astra",
      reviewerAgentId: null,
      sidebarCollapsed: false,
      selectedProvider: null,
      selectedModelId: null,
      memoryEnabled: true,
    },
  };
}

function reconcileState(saved: PersistedState): PersistedState {
  const defaults = freshState();
  const agents = saved.agents.length ? saved.agents : defaults.agents;
  const conversations = saved.conversations.length ? saved.conversations : defaults.conversations;
  const activeConversationId = conversations.some((item) => item.id === saved.preferences.activeConversationId)
    ? saved.preferences.activeConversationId
    : conversations[0]?.id ?? null;
  const activeAgentId = agents.some((item) => item.id === saved.preferences.activeAgentId)
    ? saved.preferences.activeAgentId
    : agents.find((item) => item.mode === "builder")?.id ?? null;
  const reviewerAgentId = saved.preferences.reviewerAgentId
    && agents.some((item) => item.id === saved.preferences.reviewerAgentId)
    ? saved.preferences.reviewerAgentId
    : null;
  return {
    ...saved,
    version: 2,
    conversations,
    agents,
    preferences: {
      ...saved.preferences,
      activeConversationId,
      activeAgentId,
      reviewerAgentId,
      selectedProvider: saved.preferences.selectedProvider ?? null,
      selectedModelId: saved.preferences.selectedModelId ?? null,
      memoryEnabled: saved.preferences.memoryEnabled ?? true,
    },
  };
}

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function AppMark() {
  return <span className="app-mark" aria-hidden="true"><span>›_</span></span>;
}

function Pill({ children, icon }: { children: ReactNode; icon?: IconName }) {
  return <span className="pill">{icon && <Icon name={icon} size={14} />}{children}</span>;
}

function Markdown({ children }: { children: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children: linkChildren }) => <a href={href} onClick={(event) => {
      if (!href) return;
      if (window.modelCodex) {
        event.preventDefault();
        void window.modelCodex.openExternal(href);
      }
    }}>{linkChildren}</a>,
  }}>{children}</ReactMarkdown></div>;
}

export default function App() {
  const [state, setState] = useState<PersistedState>(() => freshState());
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewId>("chat");
  const [prompt, setPrompt] = useState("");
  const [projectOpen, setProjectOpen] = useState(true);
  const [conversationFilter, setConversationFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [appInfo, setAppInfo] = useState("local desktop");
  const [provider, setProvider] = useState<ProviderId>("huggingface");
  const [sessionSecrets, setSessionSecrets] = useState<Partial<Record<ProviderId, string>>>({});
  const [modelsByProvider, setModelsByProvider] = useState<Partial<Record<ProviderId, ProviderModel[]>>>({});
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [visibleSecret, setVisibleSecret] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("council-astra");
  const [connectorSecrets, setConnectorSecrets] = useState<Record<string, Record<string, string>>>({});
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const saveRevision = useRef(0);

  useEffect(() => {
    let active = true;
    const api = window.modelCodex;
    if (!api) {
      setReady(true);
      setAppInfo("browser preview");
      return;
    }
    Promise.all([api.loadState(), api.getAppInfo()])
      .then(([saved, info]) => {
        if (!active) return;
        const next = reconcileState(saved);
        setState(next);
        setSelectedAgentId(next.preferences.activeAgentId ?? next.agents[0]?.id ?? "");
        setProvider(next.preferences.selectedProvider ?? "huggingface");
        setAppInfo(`v${info.version} · ${info.arch}`);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setToast("Local state could not be loaded. A clean workspace was opened.");
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || !window.modelCodex) return;
    const revision = ++saveRevision.current;
    const timer = window.setTimeout(() => {
      window.modelCodex.saveState(state).catch(() => {
        if (revision === saveRevision.current) setToast("Changes could not be saved locally.");
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [ready, state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeConversation = state.conversations.find((item) => item.id === state.preferences.activeConversationId) ?? null;
  const builderAgents = state.agents.filter((agent) => agent.mode === "builder");
  const reviewerAgents = state.agents.filter((agent) => agent.mode === "reviewer");
  const activeBuilder = state.agents.find((agent) => agent.id === state.preferences.activeAgentId) ?? builderAgents[0];
  const activeReviewer = state.agents.find((agent) => agent.id === state.preferences.reviewerAgentId) ?? null;
  const activeProvider = state.preferences.selectedProvider;
  const activeModelId = state.preferences.selectedModelId;
  const filteredConversations = useMemo(() => {
    const query = conversationFilter.trim().toLowerCase();
    return query ? state.conversations.filter((item) => item.title.toLowerCase().includes(query)) : state.conversations;
  }, [conversationFilter, state.conversations]);

  const patchPreferences = (patch: Partial<PersistedState["preferences"]>) => {
    setState((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }));
  };

  const createConversation = () => {
    const now = Date.now();
    const conversation: Conversation = { id: id("chat"), title: "New task", createdAt: now, updatedAt: now, messages: [] };
    setState((current) => ({
      ...current,
      conversations: [conversation, ...current.conversations],
      preferences: { ...current.preferences, activeConversationId: conversation.id },
    }));
    setPrompt("");
    setChatAttachments([]);
    setView("chat");
  };

  const deleteConversation = (conversationId: string) => {
    setState((current) => {
      const conversations = current.conversations.filter((item) => item.id !== conversationId);
      return {
        ...current,
        conversations,
        preferences: {
          ...current.preferences,
          activeConversationId: current.preferences.activeConversationId === conversationId
            ? conversations[0]?.id ?? null
            : current.preferences.activeConversationId,
        },
      };
    });
  };

  const send = async () => {
    const content = prompt.trim();
    if (!content || sending || !activeConversation || !activeBuilder) return;
    if (!activeProvider || !activeModelId || !sessionSecrets[activeProvider]) {
      setToast("Connect a provider and choose a model before sending.");
      setView("model");
      return;
    }
    if (!window.modelCodex) {
      setToast("Live inference is available in the desktop app.");
      return;
    }
    const conversationId = activeConversation.id;
    const userMessage = { id: id("message"), role: "user" as const, content, createdAt: Date.now() };
    setPrompt("");
    setSending(true);
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) => conversation.id === conversationId ? {
        ...conversation,
        title: conversation.title === "New task" ? content.slice(0, 72) : conversation.title,
        updatedAt: Date.now(),
        messages: [...conversation.messages, userMessage],
      } : conversation),
    }));
    try {
      const result = await window.modelCodex.runChat({
        provider: activeProvider,
        apiKey: sessionSecrets[activeProvider]!,
        model: activeModelId,
        conversationId,
        prompt: content,
        messages: activeConversation.messages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        conversationSummary: activeConversation.summary,
        compactedThrough: activeConversation.compactedThrough,
        memoryEnabled: state.preferences.memoryEnabled,
        builder: activeBuilder,
        reviewer: activeReviewer ?? undefined,
        attachments: chatAttachments,
        connectors: state.connectors,
        connectorSecrets,
      });
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) => conversation.id === conversationId ? {
          ...conversation,
          updatedAt: Date.now(),
          summary: result.summary ?? conversation.summary,
          compactedThrough: result.compactedThrough ?? conversation.compactedThrough,
          messages: [...conversation.messages, {
            id: id("message"),
            role: "assistant",
            content: result.content,
            createdAt: Date.now(),
            agentId: activeBuilder.name,
            model: result.model,
            trace: result.trace,
          }],
        } : conversation),
      }));
    } catch (error) {
      setPrompt(content);
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) => conversation.id === conversationId ? {
          ...conversation,
          messages: conversation.messages.filter((message) => message.id !== userMessage.id),
        } : conversation),
      }));
      setToast(error instanceof Error ? error.message : "The model request failed.");
    } finally {
      setSending(false);
    }
  };

  const attachChatFiles = async () => {
    if (!window.modelCodex) return setToast("File attachments are available in the desktop app.");
    const files = await window.modelCodex.chooseTextFiles();
    if (files.length) setChatAttachments((current) => [...current, ...files].slice(0, 25));
  };

  const connectProvider = async () => {
    const secret = sessionSecrets[provider]?.trim();
    if (!secret) return;
    if (!window.modelCodex) return setToast("Provider connections are available in the desktop app.");
    setProviderLoading(true);
    setProviderError(null);
    try {
      const models = await window.modelCodex.listModels(provider, secret);
      if (!models.length) throw new Error("This credential returned no compatible chat models.");
      setModelsByProvider((current) => ({ ...current, [provider]: models }));
      const selectedModelId = state.preferences.selectedProvider === provider && models.some((model) => model.id === state.preferences.selectedModelId)
        ? state.preferences.selectedModelId
        : models[0].id;
      patchPreferences({ selectedProvider: provider, selectedModelId });
      setToast(`${models.length} ${PROVIDERS.find((item) => item.id === provider)?.name} models loaded for this session.`);
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "The provider connection failed.");
    } finally {
      setProviderLoading(false);
    }
  };

  const changeProviderTab = (next: ProviderId) => {
    setProvider(next);
    setProviderError(null);
  };

  const updateAgent = (agentId: string, patch: Partial<AgentDefinition>) => {
    setState((current) => ({
      ...current,
      agents: current.agents.map((agent) => agent.id === agentId ? { ...agent, ...patch } : agent),
    }));
  };

  const createAgent = () => {
    const agent: AgentDefinition = {
      id: id("agent"),
      name: "Untitled agent",
      role: "Custom persona",
      mode: "builder",
      description: "A custom agent for this workspace.",
      systemPrompt: "You are a focused assistant. Follow the user's request and state uncertainty clearly.",
      source: "custom",
      tools: [],
      documents: [],
    };
    setState((current) => ({ ...current, agents: [...current.agents, agent] }));
    setSelectedAgentId(agent.id);
    setView("agents");
  };

  const selectNav = (next: ViewId) => {
    if (next === "chat") createConversation();
    else setView(next);
  };

  return (
    <main className={`app-shell ${state.preferences.sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {toast && <div className="toast"><Icon name="spark" size={15} />{toast}</div>}
      <aside className="sidebar">
        <div className="window-controls-spacer" />
        <div className="sidebar-tools">
          <button aria-label="Toggle sidebar" onClick={() => patchPreferences({ sidebarCollapsed: !state.preferences.sidebarCollapsed })}><Icon name="layout" size={17} /></button>
          <button aria-label="Back"><Icon name="back" size={18} /></button>
          <button aria-label="Forward" disabled><Icon name="forward" size={18} /></button>
        </div>

        <div className="brand-row">
          <strong>Model Codex</strong><Icon name="chevron" size={14} />
          <button aria-label="Search conversations" onClick={() => document.getElementById("conversation-search")?.focus()}><Icon name="search" size={17} /></button>
        </div>

        <nav className="main-nav" aria-label="Workspace">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => selectNav(item.id)}>
              <Icon name={item.icon} size={18} /><span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-section project-section">
          <div className="section-title"><span>Projects</span><button aria-label="New project"><Icon name="plus" size={15} /></button></div>
          <button className={`project-row ${projectOpen ? "active" : ""}`} onClick={() => setProjectOpen((current) => !current)}>
            <Icon name="folder" size={18} /><span>New project</span><Icon name="chevron" size={14} />
          </button>
          {projectOpen && (
            <div className="conversation-tree">
              <label className="conversation-search">
                <Icon name="search" size={13} />
                <input id="conversation-search" value={conversationFilter} onChange={(event) => setConversationFilter(event.target.value)} placeholder="Filter tasks" />
              </label>
              <div className="conversation-list">
                {filteredConversations.map((conversation) => (
                  <div className={`conversation-row ${conversation.id === activeConversation?.id && view === "chat" ? "active" : ""}`} key={conversation.id}>
                    <button className="conversation-select" onClick={() => { patchPreferences({ activeConversationId: conversation.id }); setChatAttachments([]); setView("chat"); }}>
                      <span>{conversation.title}</span><small>{relativeTime(conversation.updatedAt)}</small>
                    </button>
                    <button className="conversation-more" aria-label={`Delete ${conversation.title}`} onClick={() => deleteConversation(conversation.id)}><Icon name="trash" size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="footer-row"><Icon name="folder" size={18} /><span>Learning Repos</span></button>
          <button className="account-row"><span className="account-mark">A</span><span><strong>Anand</strong><small>{appInfo}</small></span><Icon name="help" size={16} /></button>
        </div>
      </aside>

      <section className="workspace">
        <div className="workspace-chrome"><span className="drag-region" /><button aria-label="Toggle activity"><Icon name="layout" size={17} /></button><button aria-label="More options"><Icon name="more" size={18} /></button></div>
        {view === "chat" && (
          <ChatView
            conversation={activeConversation}
            prompt={prompt}
            onPrompt={setPrompt}
            onSend={send}
            onNew={createConversation}
            onSuggestion={(title) => setPrompt(`${title}: `)}
            attachments={chatAttachments}
            onAttach={() => void attachChatFiles()}
            onRemoveAttachment={(fileId) => setChatAttachments((current) => current.filter((file) => file.id !== fileId))}
            sending={sending}
            providerLabel={activeProvider && activeModelId ? activeModelId : "Model"}
            memoryEnabled={state.preferences.memoryEnabled}
            onMemory={(enabled) => patchPreferences({ memoryEnabled: enabled })}
            builders={builderAgents}
            reviewers={reviewerAgents}
            builderId={activeBuilder?.id ?? ""}
            reviewerId={activeReviewer?.id ?? ""}
            onBuilder={(agentId) => patchPreferences({ activeAgentId: agentId })}
            onReviewer={(agentId) => patchPreferences({ reviewerAgentId: agentId || null })}
          />
        )}
        {view === "agents" && (
          <AgentsView
            agents={state.agents}
            selectedId={selectedAgentId}
            onSelect={setSelectedAgentId}
            onCreate={createAgent}
            onUpdate={updateAgent}
            onToast={setToast}
          />
        )}
        {view === "model" && (
          <ModelView
            provider={provider}
            onProvider={changeProviderTab}
            secrets={sessionSecrets}
            onSecret={(value) => setSessionSecrets((current) => ({ ...current, [provider]: value }))}
            visible={visibleSecret}
            onToggleVisible={() => setVisibleSecret((current) => !current)}
            onConnect={() => void connectProvider()}
            models={modelsByProvider[provider] ?? []}
            selectedModelId={state.preferences.selectedProvider === provider ? state.preferences.selectedModelId : null}
            onModel={(modelId) => patchPreferences({ selectedProvider: provider, selectedModelId: modelId })}
            loading={providerLoading}
            error={providerError}
          />
        )}
        {view === "external-apis" && (
          <ExternalApisView
            connectors={state.connectors}
            onChange={(connectors) => setState((current) => ({ ...current, connectors }))}
            secrets={connectorSecrets}
            onSecrets={setConnectorSecrets}
            onToast={setToast}
            provider={activeProvider}
            apiKey={activeProvider ? sessionSecrets[activeProvider] ?? "" : ""}
            model={activeModelId}
          />
        )}
      </section>
      {!ready && <div className="loading-cover"><AppMark /><span>Opening local workspace…</span></div>}
    </main>
  );
}

function ChatView(props: {
  conversation: Conversation | null;
  prompt: string;
  onPrompt: (value: string) => void;
  onSend: () => void;
  onNew: () => void;
  onSuggestion: (title: string) => void;
  builders: AgentDefinition[];
  reviewers: AgentDefinition[];
  builderId: string;
  reviewerId: string;
  onBuilder: (id: string) => void;
  onReviewer: (id: string) => void;
  attachments: ChatAttachment[];
  onAttach: () => void;
  onRemoveAttachment: (id: string) => void;
  sending: boolean;
  providerLabel: string;
  memoryEnabled: boolean;
  onMemory: (enabled: boolean) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const hasMessages = Boolean(props.conversation?.messages.length);
  useEffect(() => { textarea.current?.focus(); }, [props.conversation?.id]);
  return (
    <div className="chat-view">
      {!hasMessages ? (
        <div className="empty-chat">
          <AppMark />
          <h1>What should we build in <u>New project</u>?</h1>
          <div className="suggestion-grid">
            {suggestions.map((item) => (
              <button key={item.title} onClick={() => props.onSuggestion(item.title)}>
                <span className={`suggestion-icon ${item.tone}`}><Icon name={item.icon} size={20} /></span>
                <strong>{item.title}</strong><small>{item.detail}</small>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="messages">
          <div className="conversation-heading"><h1>{props.conversation?.title}</h1><button onClick={props.onNew}><Icon name="plus" size={15} />New task</button></div>
          {props.conversation?.messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              {message.role === "assistant" && <AppMark />}
              <div><header>{message.role === "assistant" ? `${message.agentId ?? "Model Codex"}${message.model ? ` · ${message.model}` : ""}` : "You"}</header>{message.role === "assistant" ? <Markdown>{message.content}</Markdown> : <p>{message.content}</p>}{message.trace && message.trace.length > 0 && <div className="trace-list">{message.trace.map((trace) => <span className={trace.status} title={trace.detail} key={trace.id}><Icon name={trace.status === "error" ? "close" : "check"} size={11} />{trace.name.replaceAll("_", " ")}</span>)}</div>}</div>
            </article>
          ))}
        </div>
      )}

      <div className="composer-dock">
        <div className="context-strip"><Pill icon="folder">New project</Pill><Pill icon="layout">Local</Pill><Pill icon="branch">main</Pill></div>
        <div className="composer">
          {props.attachments.length > 0 && <div className="composer-files">{props.attachments.map((file) => <span key={file.id}><Icon name="new" size={12} />{file.name}<button onClick={() => props.onRemoveAttachment(file.id)} aria-label={`Remove ${file.name}`}><Icon name="close" size={11} /></button></span>)}</div>}
          <textarea
            ref={textarea}
            value={props.prompt}
            onChange={(event) => props.onPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !props.sending) { event.preventDefault(); props.onSend(); }
            }}
            placeholder="Do anything"
            aria-label="Prompt"
          />
          <div className="composer-controls">
            <div className="composer-left"><button aria-label="Attach files" onClick={props.onAttach}><Icon name="plus" size={21} /></button><button className="access-chip"><Icon name="tools" size={15} />Full access</button><label className="memory-toggle" title="Memory compilation can make an additional model call"><input type="checkbox" checked={props.memoryEnabled} onChange={(event) => props.onMemory(event.target.checked)} /><span><Icon name="history" size={13} />Memory</span></label></div>
            <div className="composer-right">
              <label className="agent-select"><span>Builder</span><select value={props.builderId} onChange={(event) => props.onBuilder(event.target.value)}>{props.builders.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select><Icon name="chevron" size={13} /></label>
              <label className="agent-select reviewer"><span>Reviewer</span><select value={props.reviewerId} onChange={(event) => props.onReviewer(event.target.value)}><option value="">Off</option>{props.reviewers.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select><Icon name="chevron" size={13} /></label>
              <button className="model-compact" title={props.providerLabel}><Icon name="spark" size={14} /><span>{props.providerLabel}</span><Icon name="chevron" size={13} /></button>
              <button aria-label="Voice input"><Icon name="mic" size={19} /></button>
              <button className="send-button" disabled={!props.prompt.trim() || props.sending} onClick={props.onSend} aria-label={props.sending ? "Running" : "Send"}><Icon name={props.sending ? "stop" : "send"} size={18} /></button>
            </div>
          </div>
        </div>
        <p>Memory compilation and an enabled reviewer can make additional model calls.</p>
      </div>
    </div>
  );
}

function AgentsView(props: {
  agents: AgentDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onUpdate: (id: string, patch: Partial<AgentDefinition>) => void;
  onToast: (message: string) => void;
}) {
  const agent = props.agents.find((item) => item.id === props.selectedId) ?? props.agents[0];
  if (!agent) return null;
  const attachDocuments = async () => {
    if (!window.modelCodex) return props.onToast("File attachments are available in the desktop app.");
    const files = await window.modelCodex.chooseTextFiles();
    if (files.length) props.onUpdate(agent.id, { documents: [...agent.documents, ...files].slice(0, 25) });
  };
  return (
    <div className="page-view agents-view">
      <header className="page-header"><div><span>PERSONA WORKBENCH</span><h1>Agents</h1><p>Create cached builder prompts and independent reviewers from the Agent Council.</p></div><button className="primary" onClick={props.onCreate}><Icon name="plus" size={16} />New agent</button></header>
      <div className="agents-layout">
        <aside className="agent-list-panel">
          <label className="panel-search"><Icon name="search" size={15} /><input placeholder="Search agents" /></label>
          <div className="template-label">AGENT COUNCIL</div>
          {props.agents.map((item) => (
            <button key={item.id} className={item.id === agent.id ? "active" : ""} onClick={() => props.onSelect(item.id)}>
              <span className={`agent-avatar ${item.mode}`}>{item.name.slice(0, 1)}</span>
              <span><strong>{item.name}</strong><small>{item.role}</small></span>
              <em>{item.mode}</em>
            </button>
          ))}
        </aside>
        <section className="agent-editor">
          <div className="editor-title"><div className={`large-avatar ${agent.mode}`}>{agent.name.slice(0, 1)}</div><div><span>{agent.source === "council" ? "AGENT COUNCIL TEMPLATE" : "CUSTOM AGENT"}</span><h2>{agent.name}</h2><p>{agent.description}</p></div><span className={`mode-badge ${agent.mode}`}>{agent.mode}</span></div>
          <div className="form-grid">
            <label>Name<input value={agent.name} onChange={(event) => props.onUpdate(agent.id, { name: event.target.value })} disabled={agent.readOnly} /></label>
            <label>Mode<select value={agent.mode} onChange={(event) => props.onUpdate(agent.id, { mode: event.target.value as AgentMode })} disabled={agent.readOnly}><option value="builder">Builder</option><option value="reviewer">Reviewer</option></select></label>
          </div>
          <label className="prompt-field">System prompt<textarea value={agent.systemPrompt} onChange={(event) => props.onUpdate(agent.id, { systemPrompt: event.target.value })} readOnly={agent.readOnly} />{agent.readOnly && <small>Expert templates are system-managed. Duplicate one to customize it later.</small>}</label>
          <div className="tool-section"><div><strong>Tools</strong><p>Give this persona only the capabilities it needs.</p></div><div className="tool-toggles">{["web_search", "web_fetch", "read_files", "python"].map((tool) => <label key={tool}><input type="checkbox" checked={agent.tools.includes(tool)} disabled={agent.readOnly} onChange={(event) => props.onUpdate(agent.id, { tools: event.target.checked ? [...agent.tools, tool] : agent.tools.filter((item) => item !== tool) })} /><span>{tool.replace("_", " ")}</span></label>)}</div></div>
          <div className="documents-section"><div><strong>Reference documents</strong><p>Persisted locally with the agent; treated as untrusted context.</p></div><button className="secondary" onClick={() => void attachDocuments()}><Icon name="attach" size={15} />Add documents</button></div>
          {agent.documents.length > 0 && <div className="document-chips">{agent.documents.map((document) => <span key={document.id}><Icon name="new" size={14} />{document.name}<button onClick={() => props.onUpdate(agent.id, { documents: agent.documents.filter((item) => item.id !== document.id) })}><Icon name="close" size={12} /></button></span>)}</div>}
        </section>
      </div>
    </div>
  );
}

function ModelView(props: {
  provider: ProviderId;
  onProvider: (provider: ProviderId) => void;
  secrets: Partial<Record<ProviderId, string>>;
  onSecret: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  onConnect: () => void;
  models: ProviderModel[];
  selectedModelId: string | null;
  onModel: (id: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const selected = PROVIDERS.find((item) => item.id === props.provider)!;
  const secret = props.secrets[props.provider] ?? "";
  const [modelQuery, setModelQuery] = useState("");
  const visibleModels = props.models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(modelQuery.trim().toLowerCase()));
  return (
    <div className="page-view model-page">
      <header className="page-header"><div><span>SESSION PROVIDERS</span><h1>Model</h1><p>Connect your own provider and choose which model runs this chat.</p></div><span className="privacy-badge"><Icon name="check" size={14} />Keys clear when the app quits</span></header>
      <div className="provider-tabs">{PROVIDERS.map((item) => <button className={item.id === props.provider ? "active" : ""} onClick={() => props.onProvider(item.id)} key={item.id}><span>{item.name.slice(0, 2).toUpperCase()}</span><strong>{item.name}</strong><small>{item.detail}</small></button>)}</div>
      <div className="settings-grid">
        <section className="settings-card">
          <div className="card-heading"><span>01</span><div><h2>Connect {selected.name}</h2><p>The key is held in volatile session memory and is never written to disk.</p></div></div>
          <label>API key or token<div className="secret-field"><input type={props.visible ? "text" : "password"} value={secret} onChange={(event) => props.onSecret(event.target.value)} placeholder={selected.placeholder} autoComplete="off" /><button onClick={props.onToggleVisible}>{props.visible ? "Hide" : "Show"}</button></div></label>
          {props.error && <p className="form-error"><Icon name="close" size={13} />{props.error}</p>}
          <div className="card-actions"><button className="secondary" onClick={() => props.onSecret("")}>Clear</button><button className="primary" disabled={!secret.trim() || props.loading} onClick={props.onConnect}>{props.loading ? "Loading…" : "Connect & load models"}</button></div>
        </section>
        <section className="settings-card">
          <div className="card-heading"><span>02</span><div><h2>Choose a model</h2><p>The live catalog appears after the provider validates your key.</p></div></div>
          {props.models.length ? <><label className="model-search"><Icon name="search" size={14} /><input value={modelQuery} onChange={(event) => setModelQuery(event.target.value)} placeholder={`Search ${props.models.length} models`} /></label><div className="model-list">{visibleModels.map((model) => <button className={model.id === props.selectedModelId ? "active" : ""} onClick={() => props.onModel(model.id)} key={model.id}><span className="radio" /><span><strong>{model.name}</strong><small>{model.id}{model.contextWindow ? ` · ${model.contextWindow.toLocaleString()} context` : ""}</small></span></button>)}{visibleModels.length === 0 && <p className="no-models">No models match “{modelQuery}”.</p>}</div></> : <div className="model-placeholder"><div><span className="radio" /><span><strong>Connect to load live models</strong><small>No credential is stored</small></span></div></div>}
        </section>
      </div>
    </div>
  );
}

function ExternalApisView(props: {
  connectors: ConnectorDefinition[];
  onChange: (connectors: ConnectorDefinition[]) => void;
  secrets: Record<string, Record<string, string>>;
  onSecrets: (value: Record<string, Record<string, string>>) => void;
  onToast: (message: string) => void;
  provider: ProviderId | null;
  apiKey: string;
  model: string | null;
}) {
  const [draft, setDraft] = useState({ name: "", baseUrl: "", documentation: "" });
  const [selectedId, setSelectedId] = useState<string | null>(props.connectors[0]?.id ?? null);
  const [synthesizing, setSynthesizing] = useState(false);
  const selected = props.connectors.find((item) => item.id === selectedId) ?? null;
  const create = async () => {
    if (!draft.name.trim() || !draft.documentation.trim()) return props.onToast("Add a name and API documentation first.");
    if (!props.provider || !props.model || !props.apiKey) return props.onToast("Connect a model first so it can read the API documentation and propose a manifest.");
    if (!window.modelCodex) return props.onToast("Connector synthesis is available in the desktop app.");
    setSynthesizing(true);
    try {
      const connector = await window.modelCodex.synthesizeConnector({
        provider: props.provider,
        apiKey: props.apiKey,
        model: props.model,
        name: draft.name.trim(),
        baseUrl: draft.baseUrl.trim(),
        documentation: draft.documentation.trim(),
      });
      props.onChange([...props.connectors, connector]);
      setSelectedId(connector.id);
      setDraft({ name: "", baseUrl: "", documentation: "" });
      props.onToast("Connector draft generated. Review its operations before approving it for chat.");
    } catch (error) {
      props.onToast(error instanceof Error ? error.message : "Connector synthesis failed.");
    } finally {
      setSynthesizing(false);
    }
  };
  return (
    <div className="page-view api-page">
      <header className="page-header"><div><span>LOCAL CONNECTOR CATALOG</span><h1>External APIs</h1><p>Turn PostHog, Paddle, GA4, or any documented HTTPS API into reviewable tools.</p></div><span className="privacy-badge"><Icon name="check" size={14} />Secrets are session-only</span></header>
      <div className="api-layout">
        <section className="connector-list settings-card">
          <div className="card-heading"><span>01</span><div><h2>Your connectors</h2><p>Definitions persist locally; credentials do not.</p></div></div>
          {props.connectors.length === 0 && <div className="blank-panel"><Icon name="api" size={26} /><strong>No connectors yet</strong><p>Describe one using its API documentation.</p></div>}
          {props.connectors.map((connector) => <button className={connector.id === selectedId ? "active" : ""} onClick={() => setSelectedId(connector.id)} key={connector.id}><span className="connector-mark">{connector.name.slice(0, 2).toUpperCase()}</span><span><strong>{connector.name}</strong><small>{connector.status} · {connector.baseUrl || "base URL pending"}</small></span></button>)}
        </section>
        <section className="connector-builder settings-card">
          {selected ? <ConnectorEditor connector={selected} secrets={props.secrets[selected.id] ?? {}} onSecrets={(values) => props.onSecrets({ ...props.secrets, [selected.id]: values })} onBack={() => setSelectedId(null)} onUpdate={(patch) => props.onChange(props.connectors.map((item) => item.id === selected.id ? { ...item, ...patch } : item))} /> : <><div className="card-heading"><span>02</span><div><h2>Create from documentation</h2><p>Your selected model proposes safe fields and read operations; you approve before anything can run.</p></div></div><div className="connector-form"><label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="PostHog production" /></label><label>Base URL (optional)<input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://us.posthog.com" /></label><label>API documentation<textarea value={draft.documentation} onChange={(event) => setDraft({ ...draft, documentation: event.target.value })} placeholder="Paste API documentation or an OpenAPI excerpt…" /></label><button className="primary" disabled={synthesizing} onClick={() => void create()}><Icon name="spark" size={15} />{synthesizing ? "Reading documentation…" : "Generate connector draft"}</button></div></>}
        </section>
      </div>
    </div>
  );
}

function ConnectorEditor(props: { connector: ConnectorDefinition; secrets: Record<string, string>; onSecrets: (values: Record<string, string>) => void; onBack: () => void; onUpdate: (patch: Partial<ConnectorDefinition>) => void }) {
  return <><div className="card-heading"><span>{props.connector.name.slice(0, 2).toUpperCase()}</span><div><h2>{props.connector.name}</h2><p>{props.connector.description}</p></div><button className="text-button" onClick={props.onBack}>New connector</button></div><div className="connector-form"><div className="connector-summary"><Pill icon="globe">{props.connector.baseUrl || "URL pending"}</Pill><Pill icon="check">{props.connector.status}</Pill></div><div className="operation-list"><strong>Proposed chat tools</strong>{props.connector.operations.map((operation) => <div key={operation.id}><span>{operation.method}</span><div><strong>{operation.name}</strong><small>{operation.path} · {operation.description}</small></div></div>)}</div>{props.connector.fields.map((field) => <label key={field.id}>{field.label}<input type={field.secret ? "password" : "text"} value={props.secrets[field.id] ?? ""} onChange={(event) => props.onSecrets({ ...props.secrets, [field.id]: event.target.value })} placeholder={field.secret ? "Session-only value" : "Value"} autoComplete="off" /></label>)}<p className="local-note">These values exist only in memory and clear when Model Codex quits. The manifest stores field names, never values.</p>{props.connector.status === "draft" && <button className="primary" onClick={() => props.onUpdate({ status: "ready" })}><Icon name="check" size={15} />Approve tools for chat</button>}</div></>;
}
