import {
  BrowserWindow,
  app,
  dialog,
  ipcMain,
  protocol,
  session,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { runAgentChat, synthesizeConnector } from "./agent-runtime.js";
import { listProviderModels } from "./providers.js";
import { redactSecrets } from "./secrets.js";
import { loadState, saveState } from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const rendererOrigin = "model-codex://app";
const qaUserDataPath = process.env.MODEL_CODEX_QA_USER_DATA;

// Automated QA must never mutate a person's real local workspace. This escape hatch
// is deliberately unavailable in packaged builds and contains no credential logic.
if (!app.isPackaged && qaUserDataPath) {
  const resolvedQaPath = path.resolve(qaUserDataPath);
  const temporaryRoot = path.resolve(app.getPath("temp"));
  if (!resolvedQaPath.startsWith(`${temporaryRoot}${path.sep}`)) {
    throw new Error("MODEL_CODEX_QA_USER_DATA must be a child of the system temporary directory.");
  }
  app.setPath("userData", resolvedQaPath);
}

protocol.registerSchemesAsPrivileged([{
  scheme: "model-codex",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false },
}]);

function isTrustedSender(event: IpcMainInvokeEvent) {
  return isTrustedRendererUrl(event.senderFrame?.url ?? event.sender.getURL());
}

function isTrustedRendererUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol === "model-codex:") return url.hostname === "app";
    return Boolean(devServerUrl && url.origin === new URL(devServerUrl).origin);
  } catch {
    return false;
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent) {
  if (!isTrustedSender(event)) throw new Error("Rejected IPC request from an untrusted renderer.");
}

function contentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
  } as Record<string, string>)[ext] ?? "application/octet-stream";
}

async function registerAppProtocol() {
  const root = path.resolve(__dirname, "../../dist");
  protocol.handle("model-codex", async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== "app") return new Response("Forbidden", { status: 403 });
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    if (!path.extname(relative)) relative = "index.html";
    const candidate = path.resolve(root, relative);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      const data = await readFile(candidate);
      return new Response(data, { headers: { "Content-Type": contentType(candidate) } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function configureSecurity() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const development = details.url.startsWith("http://127.0.0.1:5173");
    const policy = development
      ? "default-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:5173; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [policy] } });
  });
}

function registerIpc() {
  ipcMain.handle("app:info", (event) => {
    assertTrustedSender(event);
    return { version: app.getVersion(), platform: process.platform, arch: process.arch };
  });
  ipcMain.handle("state:load", async (event) => {
    assertTrustedSender(event);
    return loadState();
  });
  ipcMain.handle("state:save", async (event, stateInput: unknown) => {
    assertTrustedSender(event);
    return saveState(stateInput);
  });
  ipcMain.handle("files:choose-text", async (event) => {
    assertTrustedSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const options = {
      title: "Attach reference documents",
      properties: ["openFile", "multiSelections"] as Array<"openFile" | "multiSelections">,
      filters: [{ name: "Text and data", extensions: ["txt", "md", "csv", "json", "ts", "tsx", "js", "jsx", "py", "html", "css", "yaml", "yml"] }],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled) return [];
    const files = [];
    for (const filePath of result.filePaths.slice(0, 25)) {
      const metadata = await stat(filePath);
      if (metadata.size > 2_000_000) continue;
      files.push({
        id: crypto.randomUUID(),
        name: path.basename(filePath),
        size: metadata.size,
        content: redactSecrets(await readFile(filePath, "utf8")),
      });
    }
    return files;
  });
  ipcMain.handle("provider:list-models", async (event, providerInput: unknown, apiKeyInput: unknown) => {
    assertTrustedSender(event);
    const provider = z.enum(["huggingface", "openai", "anthropic", "google"]).parse(providerInput);
    const apiKey = z.string().min(1).max(2_000).parse(apiKeyInput);
    return listProviderModels(provider, apiKey);
  });
  ipcMain.handle("agent:run-chat", async (event, request: unknown) => {
    assertTrustedSender(event);
    return runAgentChat(request);
  });
  ipcMain.handle("connector:synthesize", async (event, request: unknown) => {
    assertTrustedSender(event);
    return synthesizeConnector(request);
  });
  ipcMain.handle("app:open-external", async (event, urlInput: unknown) => {
    assertTrustedSender(event);
    const url = new URL(z.string().max(4_000).parse(urlInput));
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only web links can be opened externally.");
    await shell.openExternal(url.toString());
  });
}

function createWindow() {
  const window = new BrowserWindow({
    title: "Model Codex",
    width: 1600,
    height: 1000,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: "#ffffff",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  if (devServerUrl) void window.loadURL(devServerUrl);
  else void window.loadURL(`${rendererOrigin}/`);
}

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(async () => {
    await registerAppProtocol();
    configureSecurity();
    registerIpc();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
