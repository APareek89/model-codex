"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";

type ProviderId = "huggingface" | "openai" | "anthropic" | "google";
type ViewId = "task" | "model";
type MessageRole = "user" | "assistant";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  provider?: ProviderId;
  model?: string;
  error?: boolean;
};

type Task = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
};

type Attachment = {
  id: string;
  name: string;
  size: number;
  content: string;
};

type ActivityItem = {
  id: string;
  createdAt: number;
  tone: "neutral" | "success" | "error";
  title: string;
  detail: string;
};

type ModelOption = { id: string; label?: string; note?: string };

type ProviderDefinition = {
  id: ProviderId;
  name: string;
  eyebrow: string;
  initial: string;
  envKey: string;
  color: string;
  description: string;
  keyPlaceholder: string;
  presets: ModelOption[];
};

const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  huggingface: {
    id: "huggingface",
    name: "Hugging Face",
    eyebrow: "Open models",
    initial: "HF",
    envKey: "HF_TOKEN",
    color: "#f4b44c",
    description: "Route to hosted open models with one Hugging Face token.",
    keyPlaceholder: "hf_••••••••••••••••",
    presets: [
      { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct:fastest", label: "Qwen3 Coder 480B", note: "Coding" },
      { id: "openai/gpt-oss-120b:fastest", label: "gpt-oss 120B", note: "Reasoning + tools" },
      { id: "deepseek-ai/DeepSeek-R1:fastest", label: "DeepSeek R1", note: "Reasoning" },
      { id: "Qwen/Qwen2.5-Coder-32B-Instruct:fastest", label: "Qwen 2.5 Coder 32B", note: "Fast coding" },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    eyebrow: "GPT models",
    initial: "OA",
    envKey: "OPENAI_API_KEY",
    color: "#8dd8bd",
    description: "Use the Responses API for current GPT models and reasoning.",
    keyPlaceholder: "sk-••••••••••••••••",
    presets: [
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", note: "Flagship" },
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", note: "Balanced" },
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", note: "Fast" },
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    eyebrow: "Claude models",
    initial: "AN",
    envKey: "ANTHROPIC_API_KEY",
    color: "#d9a47f",
    description: "Connect Claude models through Anthropic’s Messages API.",
    keyPlaceholder: "sk-ant-••••••••••••",
    presets: [
      { id: "claude-fable-5", label: "Claude Fable 5", note: "Highest capability" },
      { id: "claude-opus-5", label: "Claude Opus 5", note: "Agentic coding" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Balanced" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "Fast" },
    ],
  },
  google: {
    id: "google",
    name: "Google",
    eyebrow: "Gemini models",
    initial: "G",
    envKey: "GOOGLE_API_KEY",
    color: "#89a9ff",
    description: "Use Gemini models through Google’s Generate Content API.",
    keyPlaceholder: "AIza••••••••••••••",
    presets: [
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", note: "Latest" },
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", note: "Stable" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", note: "Agentic coding" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", note: "Complex reasoning" },
    ],
  },
};

const DEFAULT_MODELS: Record<ProviderId, string> = {
  huggingface: PROVIDERS.huggingface.presets[0].id,
  openai: PROVIDERS.openai.presets[0].id,
  anthropic: PROVIDERS.anthropic.presets[1].id,
  google: PROVIDERS.google.presets[0].id,
};

const INITIAL_TASKS: Task[] = [
  {
    id: "welcome-task",
    title: "Build a multi-model workspace",
    createdAt: 0,
    updatedAt: 0,
    messages: [],
  },
  {
    id: "sample-refactor",
    title: "Refactor API routes",
    createdAt: 0,
    updatedAt: 0,
    messages: [],
  },
  {
    id: "sample-auth",
    title: "Review authentication flow",
    createdAt: 0,
    updatedAt: 0,
    messages: [],
  },
];

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type IconName =
  | "activity"
  | "arrow"
  | "attach"
  | "check"
  | "chevron"
  | "close"
  | "copy"
  | "eye"
  | "eyeOff"
  | "file"
  | "folder"
  | "menu"
  | "model"
  | "plus"
  | "refresh"
  | "search"
  | "settings"
  | "spark"
  | "stop"
  | "trash";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    activity: <><path d="M4 18V8" /><path d="M10 18V4" /><path d="M16 18v-6" /><path d="M22 18H2" /></>,
    arrow: <><path d="M12 19V5" /><path d="m6.5 10.5 5.5-5.5 5.5 5.5" /></>,
    attach: <><path d="m20.5 11.5-8.8 8.8a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.5-8.5" /></>,
    check: <path d="m5 12 4 4 10-10" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    eyeOff: <><path d="m3 3 18 18" /><path d="M10.7 6.1A10.4 10.4 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.1 2.8" /><path d="M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.6-.3 3.7-.7" /></>,
    file: <><path d="M6 2.5h8l4 4v15H6z" /><path d="M14 2.5v4h4" /></>,
    folder: <path d="M3.5 7.5h6l2-2h9v13h-17z" />,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    model: <><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    refresh: <><path d="M20 6v5h-5" /><path d="M4 18v-5h5" /><path d="M6.1 8.5A7 7 0 0 1 18 7l2 4" /><path d="m4 13 2 4a7 7 0 0 0 11.9-1.5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    spark: <><path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z" /><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" /></>,
    stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m7 7 1 13h8l1-13" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function ProviderMark({ provider, compact = false }: { provider: ProviderId; compact?: boolean }) {
  const definition = PROVIDERS[provider];
  return (
    <span
      className={`provider-logo provider-${provider} ${compact ? "compact" : ""}`}
      style={{ "--provider-color": definition.color } as CSSProperties}
    >
      {definition.initial}
    </span>
  );
}

function relativeTime(timestamp: number, referenceTime: number) {
  if (timestamp <= 0 || referenceTime <= 0) return "—";
  const minutes = Math.max(0, Math.round((referenceTime - timestamp) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function shortenTitle(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New task";
  return cleaned.length > 42 ? `${cleaned.slice(0, 41)}…` : cleaned;
}

function bytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function RichText({ content }: { content: string }) {
  const parts = content.split("```");
  return (
    <div className="rich-text">
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          return part.split("\n").map((line, lineIndex) => (
            <span className="text-line" key={`${index}-${lineIndex}`}>{line || "\u00a0"}</span>
          ));
        }
        const firstBreak = part.indexOf("\n");
        const language = firstBreak > 0 ? part.slice(0, firstBreak).trim() : "code";
        const code = firstBreak > 0 ? part.slice(firstBreak + 1) : part;
        return (
          <div className="code-block" key={index}>
            <div className="code-head"><span>{language || "code"}</span><CopyButton value={code} /></div>
            <pre><code>{code.trim()}</code></pre>
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button className="mini-action" onClick={copy} title="Copy">
      <Icon name={copied ? "check" : "copy"} size={13} /> {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ModelCodex() {
  const [view, setView] = useState<ViewId>("task");
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [activeTaskId, setActiveTaskId] = useState(INITIAL_TASKS[0].id);
  const [provider, setProvider] = useState<ProviderId>("huggingface");
  const [modelsByProvider, setModelsByProvider] = useState<Record<ProviderId, string>>(DEFAULT_MODELS);
  const [availableModels, setAvailableModels] = useState<Record<ProviderId, ModelOption[]>>({
    huggingface: PROVIDERS.huggingface.presets,
    openai: PROVIDERS.openai.presets,
    anthropic: PROVIDERS.anthropic.presets,
    google: PROVIDERS.google.presets,
  });
  const [sessionKeys, setSessionKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [draftKeys, setDraftKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [environmentConfigured, setEnvironmentConfigured] = useState<Record<ProviderId, boolean>>({
    huggingface: false,
    openai: false,
    anthropic: false,
    google: false,
  });
  const [showKey, setShowKey] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [clock, setClock] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([
    { id: "workspace-ready", createdAt: 0, tone: "success", title: "Workspace ready", detail: "Local task history is available." },
  ]);
  const fileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? tasks[0];
  const activeModel = modelsByProvider[provider];
  const providerDefinition = PROVIDERS[provider];
  const connected = Boolean(sessionKeys[provider] || environmentConfigured[provider]);

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      const hydrationTime = Date.now();
      let restoredTasks = false;
      try {
        const storedTasks = localStorage.getItem("model-codex-tasks");
        const storedSettings = localStorage.getItem("model-codex-settings");
        const storedKeys = sessionStorage.getItem("model-codex-session-keys");
        if (storedTasks) {
          const parsed = JSON.parse(storedTasks) as Task[];
          if (Array.isArray(parsed) && parsed.length) {
            setTasks(parsed);
            setActiveTaskId(parsed[0].id);
            restoredTasks = true;
          }
        }
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings) as {
            provider?: ProviderId;
            modelsByProvider?: Record<ProviderId, string>;
          };
          if (parsed.provider && PROVIDERS[parsed.provider]) setProvider(parsed.provider);
          if (parsed.modelsByProvider) setModelsByProvider({ ...DEFAULT_MODELS, ...parsed.modelsByProvider });
        }
        if (storedKeys) {
          const parsed = JSON.parse(storedKeys) as Partial<Record<ProviderId, string>>;
          setSessionKeys(parsed);
        }
      } catch {
        localStorage.removeItem("model-codex-tasks");
      }
      if (!restoredTasks) {
        setTasks(INITIAL_TASKS.map((task, index) => ({
          ...task,
          createdAt: hydrationTime - index * 20 * 60_000,
          updatedAt: hydrationTime - index * 20 * 60_000,
        })));
      }
      setActivities((current) => current.map((item) => (
        item.createdAt === 0 ? { ...item, createdAt: hydrationTime } : item
      )));
      setClock(hydrationTime);
      setHydrated(true);
    }, 0);

    fetch("/api/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: Record<ProviderId, boolean> }) => {
        if (data.configured) setEnvironmentConfigured(data.configured);
      })
      .catch(() => undefined);

    return () => window.clearTimeout(hydration);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const interval = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("model-codex-tasks", JSON.stringify(tasks.slice(0, 30)));
  }, [tasks, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("model-codex-settings", JSON.stringify({ provider, modelsByProvider }));
  }, [provider, modelsByProvider, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem("model-codex-session-keys", JSON.stringify(sessionKeys));
  }, [sessionKeys, hydrated]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTask?.messages.length, loading]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const addActivity = useCallback((item: Omit<ActivityItem, "id" | "createdAt">) => {
    setActivities((current) => [{ ...item, id: uid(), createdAt: Date.now() }, ...current].slice(0, 30));
  }, []);

  const createTask = useCallback(() => {
    const task: Task = {
      id: uid(),
      title: "New task",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setTasks((current) => [task, ...current]);
    setActiveTaskId(task.id);
    setView("task");
    setPrompt("");
    setAttachments([]);
    setMobileSidebarOpen(false);
    window.setTimeout(() => promptInput.current?.focus(), 80);
  }, []);

  useEffect(() => {
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createTask();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [createTask]);

  const removeTask = (taskId: string) => {
    if (tasks.length === 1) {
      createTask();
      return;
    }
    const remaining = tasks.filter((task) => task.id !== taskId);
    setTasks(remaining);
    if (activeTaskId === taskId) setActiveTaskId(remaining[0].id);
  };

  const selectTask = (taskId: string) => {
    setActiveTaskId(taskId);
    setView("task");
    setMobileSidebarOpen(false);
  };

  const updateTaskMessages = (taskId: string, updater: (messages: Message[]) => Message[]) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== taskId) return task;
      const messages = updater(task.messages);
      const firstUser = messages.find((message) => message.role === "user");
      return {
        ...task,
        title: task.title === "New task" && firstUser ? shortenTitle(firstUser.content) : task.title,
        updatedAt: Date.now(),
        messages,
      };
    }).sort((a, b) => b.updatedAt - a.updatedAt));
  };

  const readFiles = async (selected: File[]) => {
    if (!selected.length) return;

    const next: Attachment[] = [];
    for (const file of selected.slice(0, 8)) {
      if (file.size > 120_000) {
        setToast(`${file.name} is over the 120 KB context limit.`);
        continue;
      }
      try {
        const content = await file.text();
        next.push({ id: uid(), name: file.name, size: file.size, content });
      } catch {
        setToast(`Could not read ${file.name}.`);
      }
    }
    setAttachments((current) => [...current, ...next].slice(0, 8));
    if (next.length) {
      addActivity({ tone: "neutral", title: "Context attached", detail: `${next.length} file${next.length === 1 ? "" : "s"} ready for the next request.` });
    }
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    await readFiles(selected);
  };

  const buildContext = () => attachments
    .map((file) => `--- FILE: ${file.name} ---\n${file.content}`)
    .join("\n\n");

  const sendMessage = async () => {
    const content = prompt.trim();
    if (!content || loading || !activeTask) return;
    if (!connected) {
      setToast(`Connect ${providerDefinition.name} in the Model tab first.`);
      setView("model");
      return;
    }

    const taskId = activeTask.id;
    const userMessage: Message = { id: uid(), role: "user", content, createdAt: Date.now() };
    const conversation = [...activeTask.messages.filter((message) => !message.error), userMessage];
    updateTaskMessages(taskId, (messages) => [...messages, userMessage]);
    setPrompt("");
    setLoading(true);
    abortRef.current = new AbortController();
    addActivity({ tone: "neutral", title: "Request started", detail: `${providerDefinition.name} · ${activeModel}` });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          provider,
          model: activeModel,
          sessionKey: sessionKeys[provider] ?? "",
          messages: conversation.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          context: buildContext(),
        }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "The provider request failed.");
      }
      if (!response.body) throw new Error("The provider returned no response stream.");
      const assistantId = uid();
      const assistant: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        provider,
        model: activeModel,
      };
      updateTaskMessages(taskId, (messages) => [...messages, assistant]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let generatedText = "";
      while (true) {
        const { value, done } = await reader.read();
        generatedText += decoder.decode(value, { stream: !done });
        if (value?.length) {
          const currentText = generatedText;
          updateTaskMessages(taskId, (messages) => messages.map((message) => (
            message.id === assistantId ? { ...message, content: currentText } : message
          )));
        }
        if (done) break;
      }
      if (!generatedText.trim()) throw new Error("The provider returned an empty response.");
      addActivity({ tone: "success", title: "Response complete", detail: `${providerDefinition.name} returned a response.` });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        addActivity({ tone: "neutral", title: "Request stopped", detail: "Generation was stopped before completion." });
      } else {
        const detail = error instanceof Error ? error.message : "The request failed.";
        updateTaskMessages(taskId, (messages) => [...messages, {
          id: uid(),
          role: "assistant",
          content: detail,
          createdAt: Date.now(),
          provider,
          model: activeModel,
          error: true,
        }]);
        addActivity({ tone: "error", title: "Request failed", detail });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handlePromptKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const stopGeneration = () => abortRef.current?.abort();

  const saveSessionKey = async () => {
    const value = draftKeys[provider]?.trim() ?? "";
    if (!value) {
      setToast(`Paste a ${providerDefinition.name} key first.`);
      return;
    }
    const connectedProvider = provider;
    const loaded = await refreshModels(value, true);
    if (!loaded) return;
    setSessionKeys((current) => ({ ...current, [connectedProvider]: value }));
    setDraftKeys((current) => ({ ...current, [connectedProvider]: "" }));
    addActivity({ tone: "success", title: "Provider connected", detail: `${PROVIDERS[connectedProvider].name} session credential saved and models loaded.` });
  };

  const clearSessionKey = () => {
    setSessionKeys((current) => {
      const next = { ...current };
      delete next[provider];
      return next;
    });
    setDraftKeys((current) => ({ ...current, [provider]: "" }));
    setToast(environmentConfigured[provider] ? `Using ${providerDefinition.envKey} from .env.` : "Session key removed.");
  };

  async function refreshModels(keyOverride?: string, isConnecting = false) {
    const requestedProvider = provider;
    const requestedDefinition = PROVIDERS[requestedProvider];
    const effectiveKey = keyOverride?.trim() || draftKeys[requestedProvider]?.trim() || sessionKeys[requestedProvider] || "";
    if (!environmentConfigured[requestedProvider] && !effectiveKey) {
      setToast(`Connect ${providerDefinition.name} before refreshing models.`);
      return false;
    }
    setLoadingModels(true);
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: requestedProvider,
          sessionKey: effectiveKey,
        }),
      });
      const data = await response.json() as { models?: ModelOption[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not refresh models.");
      const models = data.models ?? [];
      const merged = [...requestedDefinition.presets, ...models].filter((item, index, all) => (
        all.findIndex((candidate) => candidate.id === item.id) === index
      ));
      setAvailableModels((current) => ({ ...current, [requestedProvider]: merged }));
      setToast(isConnecting
        ? `${requestedDefinition.name} connected · ${models.length} models loaded.`
        : `Loaded ${models.length} model${models.length === 1 ? "" : "s"} from ${requestedDefinition.name}.`);
      addActivity({ tone: "success", title: "Models refreshed", detail: `${models.length} available from ${requestedDefinition.name}.` });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh models.";
      setToast(message);
      addActivity({ tone: "error", title: "Model refresh failed", detail: message });
      return false;
    } finally {
      setLoadingModels(false);
    }
  }

  const selectProvider = (nextProvider: ProviderId) => {
    setProvider(nextProvider);
    setModelQuery("");
    setCustomModel("");
    setShowKey(false);
  };

  const chooseModel = (modelId: string) => {
    setModelsByProvider((current) => ({ ...current, [provider]: modelId }));
    setToast(`${modelId} is now active.`);
    addActivity({ tone: "success", title: "Active model changed", detail: `${PROVIDERS[provider].name} · ${modelId}` });
  };

  const addCustomModel = () => {
    const modelId = customModel.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(modelId)) {
      setToast("Enter a valid provider model ID.");
      return;
    }
    setAvailableModels((current) => ({
      ...current,
      [provider]: current[provider].some((item) => item.id === modelId)
        ? current[provider]
        : [{ id: modelId, label: modelId, note: "Custom" }, ...current[provider]],
    }));
    chooseModel(modelId);
    setCustomModel("");
  };

  const filteredTasks = useMemo(() => {
    const query = taskQuery.trim().toLowerCase();
    return query ? tasks.filter((task) => task.title.toLowerCase().includes(query)) : tasks;
  }, [tasks, taskQuery]);

  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    return query
      ? availableModels[provider].filter((model) => `${model.label ?? ""} ${model.id}`.toLowerCase().includes(query))
      : availableModels[provider];
  }, [availableModels, modelQuery, provider]);

  const switchView = (nextView: ViewId) => {
    setView(nextView);
    setMobileSidebarOpen(false);
  };

  return (
    <main className="app-frame">
      {toast && <div className="toast"><Icon name="check" size={14} />{toast}</div>}
      {mobileSidebarOpen && <button className="mobile-scrim" aria-label="Close sidebar" onClick={() => setMobileSidebarOpen(false)} />}

      <aside className={`sidebar ${mobileSidebarOpen ? "mobile-open" : ""}`}>
        <div className="brand-row">
          <div className="app-mark"><Icon name="spark" size={14} /></div>
          <strong>Model Codex</strong>
          <button className="icon-button" onClick={() => setSearchOpen((value) => !value)} title="Search tasks (⌘K)">
            <Icon name="search" />
          </button>
        </div>

        {searchOpen && (
          <div className="sidebar-search">
            <Icon name="search" size={14} />
            <input aria-label="Search tasks" autoFocus value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} placeholder="Search tasks" />
            <button onClick={() => { setSearchOpen(false); setTaskQuery(""); }} aria-label="Close search"><Icon name="close" size={13} /></button>
          </div>
        )}

        <button className="new-task" onClick={createTask}>
          <Icon name="plus" /> New task <span>⌘ N</span>
        </button>

        <nav className="primary-nav" aria-label="Workspace views">
          <button className={`nav-item ${view === "task" ? "active" : ""}`} onClick={() => switchView("task")}>
            <Icon name="spark" /> Tasks
          </button>
          <button className={`nav-item ${view === "model" ? "active" : ""}`} onClick={() => switchView("model")}>
            <Icon name="model" /> Model <span className="new-pill">NEW</span>
          </button>
        </nav>

        <div className="task-section">
          <div className="section-label"><span>Recent</span><small>{filteredTasks.length}</small></div>
          <div className="task-list">
            {filteredTasks.map((task) => (
              <div className={`task-row ${task.id === activeTaskId && view === "task" ? "active" : ""}`} key={task.id}>
                <button className="task-item" onClick={() => selectTask(task.id)}>
                  <span>{task.title}</span>
                  <small>{relativeTime(task.updatedAt, clock)}</small>
                </button>
                <button className="task-delete" onClick={() => removeTask(task.id)} title="Delete task"><Icon name="trash" size={13} /></button>
              </div>
            ))}
            {!filteredTasks.length && <p className="empty-state">No matching tasks.</p>}
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="profile">
            <span>AP</span>
            <div><strong>Anand&apos;s workspace</strong><small>Local-first</small></div>
            <Icon name="chevron" size={14} />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" onClick={() => setMobileSidebarOpen(true)} aria-label="Open sidebar"><Icon name="menu" /></button>
            <button className="project-chip">
              <span className="status-dot" /> New project <Icon name="chevron" size={13} />
            </button>
          </div>
          <div className="view-tabs" role="tablist" aria-label="Main views">
            <button role="tab" aria-selected={view === "task"} className={view === "task" ? "active" : ""} onClick={() => switchView("task")}>Task</button>
            <button role="tab" aria-selected={view === "model"} className={view === "model" ? "active" : ""} onClick={() => switchView("model")}>Model <span /></button>
          </div>
          <div className="top-actions">
            <button className="ghost-button" onClick={() => fileInput.current?.click()}><Icon name="folder" /> Open</button>
            <button className={`icon-button ${activityOpen ? "selected" : ""}`} onClick={() => setActivityOpen((value) => !value)} title="Activity"><Icon name="activity" /></button>
            <button className="icon-button" onClick={() => switchView("model")} title="Settings"><Icon name="settings" /></button>
          </div>
        </header>

        <div className="workspace-body">
          {view === "task" ? (
            <TaskView
              task={activeTask}
              provider={provider}
              model={activeModel}
              prompt={prompt}
              setPrompt={setPrompt}
              attachments={attachments}
              setAttachments={setAttachments}
              loading={loading}
              connected={connected}
              clock={clock}
              promptInput={promptInput}
              fileInput={fileInput}
              onDropFiles={readFiles}
              onPromptKey={handlePromptKey}
              onSend={sendMessage}
              onStop={stopGeneration}
              onOpenModels={() => setView("model")}
              messagesEnd={messagesEnd}
            />
          ) : (
            <ModelView
              provider={provider}
              providerDefinition={providerDefinition}
              models={filteredModels}
              selectedModel={activeModel}
              connected={connected}
              environmentConfigured={environmentConfigured[provider]}
              sessionConnected={Boolean(sessionKeys[provider])}
              draftKey={draftKeys[provider] ?? ""}
              showKey={showKey}
              modelQuery={modelQuery}
              customModel={customModel}
              loadingModels={loadingModels}
              onProvider={selectProvider}
              onDraftKey={(value) => setDraftKeys((current) => ({ ...current, [provider]: value }))}
              onToggleKey={() => setShowKey((value) => !value)}
              onSaveKey={saveSessionKey}
              onClearKey={clearSessionKey}
              onModelQuery={setModelQuery}
              onChooseModel={chooseModel}
              onCustomModel={setCustomModel}
              onAddCustomModel={addCustomModel}
              onRefreshModels={() => refreshModels()}
              onStartTask={() => { setView("task"); promptInput.current?.focus(); }}
            />
          )}

          {activityOpen && (
            <aside className="activity-panel">
              <div className="activity-head">
                <div><strong>Activity</strong><small>Local request log</small></div>
                <button className="icon-button" onClick={() => setActivityOpen(false)}><Icon name="close" /></button>
              </div>
              <div className="activity-list">
                {activities.map((item) => (
                  <article className={`activity-item ${item.tone}`} key={item.id}>
                    <i />
                    <div><strong>{item.title}</strong><p>{item.detail}</p><small>{relativeTime(item.createdAt, clock)}</small></div>
                  </article>
                ))}
              </div>
              <div className="activity-foot">Secrets are never included in this log.</div>
            </aside>
          )}
        </div>

        <footer className="statusbar">
          <span><i className={connected ? "connected" : ""} /> {connected ? `${providerDefinition.name} ready` : "Provider not connected"}</span>
          <button onClick={() => setActivityOpen((value) => !value)}><Icon name="activity" size={12} /> Activity</button>
          <span>Workspace access · Model controlled</span>
        </footer>
      </section>

      <input
        ref={fileInput}
        className="hidden-input"
        type="file"
        multiple
        accept=".txt,.md,.mdx,.json,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.css,.html,.yml,.yaml,.toml,.sql,.sh"
        onChange={handleFiles}
      />
    </main>
  );
}

function TaskView(props: {
  task: Task;
  provider: ProviderId;
  model: string;
  prompt: string;
  setPrompt: (value: string) => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  loading: boolean;
  connected: boolean;
  clock: number;
  promptInput: RefObject<HTMLTextAreaElement | null>;
  fileInput: RefObject<HTMLInputElement | null>;
  onDropFiles: (files: File[]) => Promise<void>;
  onPromptKey: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => Promise<void>;
  onStop: () => void;
  onOpenModels: () => void;
  messagesEnd: RefObject<HTMLDivElement | null>;
}) {
  const {
    task, provider, model, prompt, setPrompt, attachments, setAttachments, loading,
    connected, clock, promptInput, fileInput, onDropFiles, onPromptKey, onSend, onStop, onOpenModels, messagesEnd,
  } = props;
  const hasMessages = task.messages.length > 0;

  const composer = (
    <div
      className="composer"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!event.dataTransfer.files.length) return;
        void onDropFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {attachments.length > 0 && (
        <div className="attachment-row">
          {attachments.map((file) => (
            <span className="attachment-chip" key={file.id}>
              <Icon name="file" size={13} /><span>{file.name}<small>{bytes(file.size)}</small></span>
              <button onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))} aria-label={`Remove ${file.name}`}><Icon name="close" size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={promptInput}
        aria-label="Task prompt"
        placeholder="Ask Model Codex to build, explain, or fix something…"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={onPromptKey}
        rows={hasMessages ? 2 : 3}
      />
      <div className="composer-bar">
        <div>
          <button className="composer-button" onClick={() => fileInput.current?.click()}><Icon name="attach" /> Add context</button>
          <button className={`model-chip ${!connected ? "attention" : ""}`} onClick={onOpenModels}>
            <ProviderMark provider={provider} compact />
            <span className="model-chip-label">{model}</span>
            <Icon name="chevron" size={12} />
          </button>
        </div>
        {loading ? (
          <button className="send-button stop" onClick={onStop} aria-label="Stop generation"><Icon name="stop" size={15} /></button>
        ) : (
          <button className="send-button" disabled={!prompt.trim()} onClick={() => void onSend()} aria-label="Send"><Icon name="arrow" size={17} /></button>
        )}
      </div>
    </div>
  );

  if (!hasMessages) {
    return (
      <div className="welcome">
        <div className="welcome-mark"><Icon name="spark" size={20} /></div>
        <h1>What do you want to build?</h1>
        <p>Choose any provider, add project context, and work from one focused space.</p>
        {composer}
        <div className="suggestions">
          <button onClick={() => fileInput.current?.click()}><Icon name="folder" /><span><strong>Build from this folder</strong><small>Attach source files and start coding</small></span></button>
          <button onClick={onOpenModels}><Icon name="model" /><span><strong>Connect a model</strong><small>Hugging Face, OpenAI, Claude, or Gemini</small></span></button>
          <button onClick={() => setPrompt("Review the attached code for bugs, security issues, and maintainability risks.")}><Icon name="search" /><span><strong>Review code</strong><small>Find issues and explain practical fixes</small></span></button>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-shell">
      <div className="conversation-head">
        <div><h1>{task.title}</h1><p>{task.messages.length} messages · {PROVIDERS[provider].name}</p></div>
        <CopyButton value={task.messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n")} />
      </div>
      <div className="message-list">
        {task.messages.map((message) => (
          <article className={`message ${message.role} ${message.error ? "error" : ""}`} key={message.id}>
            {message.role === "assistant" && <div className="assistant-mark"><ProviderMark provider={message.provider ?? provider} compact /></div>}
            <div className="message-content">
              <div className="message-meta">
                <strong>{message.role === "user" ? "You" : PROVIDERS[message.provider ?? provider].name}</strong>
                <span>{relativeTime(message.createdAt, clock)}</span>
                {message.model && <small>{message.model}</small>}
              </div>
              {message.role === "assistant"
                ? message.content
                  ? <RichText content={message.content} />
                  : <div className="thinking"><i /><i /><i /><span>{PROVIDERS[message.provider ?? provider].name} is working</span></div>
                : <p>{message.content}</p>}
              {message.role === "assistant" && <div className="message-actions"><CopyButton value={message.content} /></div>}
            </div>
          </article>
        ))}
        {loading && task.messages.at(-1)?.role !== "assistant" && (
          <article className="message assistant pending">
            <div className="assistant-mark"><ProviderMark provider={provider} compact /></div>
            <div className="message-content"><div className="thinking"><i /><i /><i /><span>{PROVIDERS[provider].name} is working</span></div></div>
          </article>
        )}
        <div ref={messagesEnd} />
      </div>
      <div className="conversation-composer">{composer}<p>Enter to send · Shift + Enter for a new line</p></div>
    </div>
  );
}

function ModelView(props: {
  provider: ProviderId;
  providerDefinition: ProviderDefinition;
  models: ModelOption[];
  selectedModel: string;
  connected: boolean;
  environmentConfigured: boolean;
  sessionConnected: boolean;
  draftKey: string;
  showKey: boolean;
  modelQuery: string;
  customModel: string;
  loadingModels: boolean;
  onProvider: (provider: ProviderId) => void;
  onDraftKey: (value: string) => void;
  onToggleKey: () => void;
  onSaveKey: () => Promise<void>;
  onClearKey: () => void;
  onModelQuery: (value: string) => void;
  onChooseModel: (model: string) => void;
  onCustomModel: (value: string) => void;
  onAddCustomModel: () => void;
  onRefreshModels: () => Promise<void>;
  onStartTask: () => void;
}) {
  const {
    provider, providerDefinition, models, selectedModel, connected, environmentConfigured,
    sessionConnected, draftKey, showKey, modelQuery, customModel, loadingModels,
    onProvider, onDraftKey, onToggleKey, onSaveKey, onClearKey, onModelQuery,
    onChooseModel, onCustomModel, onAddCustomModel, onRefreshModels, onStartTask,
  } = props;

  return (
    <div className="model-view">
      <section className="model-heading">
        <div>
          <span className="page-eyebrow">MODEL ROUTER</span>
          <h1>Bring your own model</h1>
          <p>Connect a provider, choose a model, then use it across every task.</p>
        </div>
        <button className="primary-button" onClick={onStartTask}><Icon name="spark" /> Start a task</button>
      </section>

      <div className="security-note">
        <div className="lock-mark">•••</div>
        <div><strong>Keys stay server-side or in this browser session.</strong><p>Environment keys are never returned to the UI. Session keys are cleared when the browser session ends.</p></div>
      </div>

      <section className="provider-strip" aria-label="AI providers">
        {(Object.keys(PROVIDERS) as ProviderId[]).map((providerId) => {
          const definition = PROVIDERS[providerId];
          return (
            <button className={provider === providerId ? "active" : ""} onClick={() => onProvider(providerId)} key={providerId}>
              <ProviderMark provider={providerId} />
              <span><strong>{definition.name}</strong><small>{definition.eyebrow}</small></span>
              {provider === providerId && <Icon name="check" size={15} />}
            </button>
          );
        })}
      </section>

      <div className="model-grid">
        <section className="settings-card credential-card">
          <div className="card-head">
            <div><span>01</span><div><h2>Connect {providerDefinition.name}</h2><p>{providerDefinition.description}</p></div></div>
            <span className={`connection-badge ${connected ? "connected" : ""}`}><i />{connected ? "Connected" : "Not connected"}</span>
          </div>

          <div className="env-status">
            <div className="env-code"><span>$</span>{providerDefinition.envKey}</div>
            <span className={environmentConfigured ? "found" : "missing"}>{environmentConfigured ? "Found in .env" : "Not found"}</span>
          </div>

          <div className="or-divider"><span>or connect for this session</span></div>
          <label className="field-label" htmlFor="provider-key">API key or token</label>
          <div className="secret-input">
            <input
              id="provider-key"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={draftKey}
              onChange={(event) => onDraftKey(event.target.value)}
              placeholder={sessionConnected ? "Session key is connected" : providerDefinition.keyPlaceholder}
            />
            <button onClick={onToggleKey} aria-label={showKey ? "Hide key" : "Show key"}><Icon name={showKey ? "eyeOff" : "eye"} /></button>
          </div>
          <div className="credential-actions">
            <button className="secondary-button" onClick={onClearKey} disabled={!sessionConnected && !draftKey}>Clear session key</button>
            <button className="primary-button" onClick={() => void onSaveKey()} disabled={!draftKey.trim() || loadingModels}><Icon name={loadingModels ? "refresh" : "check"} /> {loadingModels ? "Connecting…" : "Connect & load models"}</button>
          </div>
          <p className="field-help">For local use, add <code>{providerDefinition.envKey}=…</code> to <code>.env</code> and restart the app.</p>
        </section>

        <section className="settings-card models-card">
          <div className="card-head">
            <div><span>02</span><div><h2>Choose a model</h2><p>Presets plus every model your provider exposes.</p></div></div>
            <button className="refresh-button" onClick={() => void onRefreshModels()} disabled={loadingModels}>
              <Icon name="refresh" />{loadingModels ? "Loading…" : "Refresh"}
            </button>
          </div>

          <label className="model-search">
            <Icon name="search" size={14} />
            <input value={modelQuery} onChange={(event) => onModelQuery(event.target.value)} placeholder="Filter models" />
          </label>

          <div className="model-list">
            {models.slice(0, 80).map((model) => (
              <button className={selectedModel === model.id ? "active" : ""} onClick={() => onChooseModel(model.id)} key={model.id}>
                <span className="radio"><i /></span>
                <span><strong>{model.label || model.id}</strong><small>{model.id}</small></span>
                {model.note && <em>{model.note}</em>}
              </button>
            ))}
            {!models.length && <div className="no-models">No models match this filter.</div>}
          </div>

          <div className="custom-model">
            <label htmlFor="custom-model">Custom model ID</label>
            <div><input id="custom-model" value={customModel} onChange={(event) => onCustomModel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onAddCustomModel(); }} placeholder="provider/model-name" /><button onClick={onAddCustomModel}>Use model</button></div>
          </div>
        </section>
      </div>

      <section className="active-route">
        <div><span>ACTIVE ROUTE</span><ProviderMark provider={provider} /><div><strong>{providerDefinition.name}</strong><small>{selectedModel}</small></div></div>
        <p>{connected ? "Ready for new tasks" : `Add ${providerDefinition.envKey} or a session key to start.`}</p>
      </section>
    </div>
  );
}
