import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { Agent, fetch, type RequestInit, type Response } from "undici";
import type { ChatAttachment, ConnectorDefinition } from "../src/types.js";

export type ToolContext = {
  allowedTools: string[];
  attachments: ChatAttachment[];
  connectors: ConnectorDefinition[];
  connectorSecrets: Record<string, Record<string, string>>;
};

export type ToolDefinition = { name: string; description: string; arguments: Record<string, string> };

const MAX_HTTP_BYTES = 2_000_000;
const MAX_TOOL_OUTPUT = 24_000;

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function privateIp(address: string) {
  const value = normalizeHost(address);
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice(7);
    if (mapped.includes(".")) return privateIp(mapped);
    const [high, low] = mapped.split(":").map((part) => Number.parseInt(part, 16));
    if (Number.isInteger(high) && Number.isInteger(low)) return privateIp(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    return true;
  }
  if (value === "::" || value === "::1" || value === "0:0:0:0:0:0:0:1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("ff")) return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

async function validateExternalUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Only HTTPS URLs are allowed.");
  const hostname = normalizeHost(url.hostname);
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || privateIp(hostname)) throw new Error("Private and local network targets are blocked.");
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => privateIp(item.address))) throw new Error("The target resolved to a private or unavailable address.");
  return { url, addresses };
}

function pinnedDispatcher(addresses: LookupAddress[]) {
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) {
      callback(null, addresses);
      return;
    }
    const requestedFamily = options.family === 4 || options.family === 6 ? options.family : undefined;
    const selected = addresses.find((address) => !requestedFamily || address.family === requestedFamily) ?? addresses[0];
    if (!selected) {
      const error = Object.assign(new Error("The approved public address is no longer available."), { code: "ENOTFOUND" });
      callback(error, "", 0);
      return;
    }
    callback(null, selected.address, selected.family);
  };
  return new Agent({ connect: { lookup: pinnedLookup } });
}

async function boundedResponse(response: Response) {
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > MAX_HTTP_BYTES) throw new Error("The response exceeds the 2 MB tool limit.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_HTTP_BYTES) throw new Error("The response exceeds the 2 MB tool limit.");
  return new TextDecoder().decode(bytes);
}

async function secureFetch(raw: string, init: RequestInit = {}) {
  let target = await validateExternalUrl(raw);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    const dispatcher = pinnedDispatcher(target.addresses);
    try {
      const response = await fetch(target.url, {
        ...init,
        dispatcher,
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "ModelCodex/0.2 (+local desktop research tool)", ...init.headers },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("The server returned an invalid redirect.");
        target = await validateExternalUrl(new URL(location, target.url).toString());
        continue;
      }
      const text = await boundedResponse(response);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
      return { response, text, finalUrl: target.url.toString() };
    } finally {
      clearTimeout(timer);
      await dispatcher.destroy();
    }
  }
  throw new Error("Too many redirects.");
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", quot: "\"", apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_all, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function htmlToText(html: string) {
  return decodeEntities(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clip(value: string) {
  return value.length > MAX_TOOL_OUTPUT ? `${value.slice(0, MAX_TOOL_OUTPUT)}\n[output clipped]` : value;
}

async function webFetch(args: Record<string, unknown>) {
  const target = String(args.url ?? "");
  if (!target) throw new Error("web_fetch requires a url.");
  const { response, text, finalUrl } = await secureFetch(target, { headers: { Accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.5" } });
  const type = response.headers.get("content-type") ?? "";
  const content = type.includes("html") ? htmlToText(text) : text;
  return clip(`URL: ${finalUrl}\nContent-Type: ${type || "unknown"}\n\n${content}`);
}

async function webSearch(args: Record<string, unknown>) {
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("web_search requires a query.");
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const { text } = await secureFetch(url, { headers: { Accept: "text/html" } });
  const matches = [...text.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>)?/gi)].slice(0, 8);
  const results = matches.map((match, index) => {
    let href = decodeEntities(match[1]);
    try {
      const parsed = new URL(href, "https://duckduckgo.com");
      href = parsed.searchParams.get("uddg") ?? parsed.toString();
    } catch { /* retain raw URL */ }
    const title = htmlToText(match[2]);
    const snippet = htmlToText(match[3] ?? "");
    return `${index + 1}. ${title}\n${href}${snippet ? `\n${snippet}` : ""}`;
  });
  if (!results.length) return "No public web results were returned. Try a narrower query or a configured search API connector.";
  return clip(`Search results for: ${query}\n\n${results.join("\n\n")}`);
}

function readFiles(args: Record<string, unknown>, attachments: ChatAttachment[]) {
  const requested = String(args.name ?? args.file ?? "").toLowerCase();
  const files = requested ? attachments.filter((file) => file.id === requested || file.name.toLowerCase().includes(requested)) : attachments;
  if (!files.length) throw new Error("No matching attached file is available in this chat.");
  return clip(files.map((file) => `# ${file.name}\n${file.content}`).join("\n\n"));
}

async function python(args: Record<string, unknown>) {
  const code = String(args.code ?? "");
  if (!code.trim()) throw new Error("python requires code.");
  if (code.length > 30_000) throw new Error("Python code exceeds the 30 KB limit.");
  const directory = await mkdtemp(path.join(tmpdir(), "model-codex-python-"));
  const script = path.join(directory, "task.py");
  await writeFile(script, code, { encoding: "utf8", mode: 0o600 });
  try {
    const candidates = [
      "/Applications/Xcode.app/Contents/Developer/usr/bin/python3",
      "/Library/Developer/CommandLineTools/usr/bin/python3",
      "/usr/bin/python3",
    ];
    let executable = "";
    for (const candidate of candidates) {
      try { await access(candidate); executable = candidate; break; } catch { /* try next macOS Python location */ }
    }
    if (!executable) throw new Error("Python is unavailable. Install Apple's Command Line Tools to enable this tool.");
    return await new Promise<string>((resolve, reject) => {
      const sandbox = "/usr/bin/sandbox-exec";
      const profile = `(version 1) (allow default) (deny network*) (deny file-read* (subpath "/Users") (subpath "/Volumes")) (deny file-write* (require-not (subpath "${directory}")) (require-not (literal "/dev/null")) (require-not (literal "/dev/stdout")) (require-not (literal "/dev/stderr")))`;
      const child = spawn(sandbox, ["-p", profile, executable, "-B", "-I", "-S", script], { cwd: directory, env: { PATH: "/usr/bin:/bin", HOME: directory, TMPDIR: directory }, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Python exceeded the 15 second limit.")); }, 15_000);
      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); if (stdout.length > MAX_TOOL_OUTPUT) child.kill("SIGKILL"); });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); if (stderr.length > 8_000) child.kill("SIGKILL"); });
      child.on("error", () => { clearTimeout(timer); reject(new Error("Apple's Python command is unavailable. Install Command Line Tools to enable this tool.")); });
      child.on("close", (status, signal) => {
        clearTimeout(timer);
        if (status === 0) resolve(clip(stdout || "Python completed without output."));
        else reject(new Error(clip(stderr || `Python exited with ${signal ? `signal ${signal}` : `status ${status}`}.`)));
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function connectorToolName(connector: ConnectorDefinition, operationId: string) {
  return `api_${connector.id}_${operationId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function connectorCall(name: string, args: Record<string, unknown>, context: ToolContext) {
  const match = context.connectors.flatMap((connector) => connector.operations.map((operation) => ({ connector, operation }))).find(({ connector, operation }) => connectorToolName(connector, operation.id) === name);
  if (!match || match.connector.status !== "ready") throw new Error("This connector operation is not approved.");
  const { connector, operation } = match;
  const values = context.connectorSecrets[connector.id] ?? {};
  let operationPath = operation.path;
  const query = new URLSearchParams();
  const body: Record<string, unknown> = {};
  for (const parameter of operation.parameters) {
    const value = args[parameter.id];
    if (parameter.required && (value === undefined || value === "")) throw new Error(`Missing required parameter: ${parameter.label}`);
    if (value === undefined || value === "") continue;
    if (parameter.location === "path") operationPath = operationPath.replace(`{${parameter.id}}`, encodeURIComponent(String(value)));
    else if (parameter.location === "query") query.set(parameter.id, String(value));
    else body[parameter.id] = value;
  }
  const base = new URL(connector.baseUrl.endsWith("/") ? connector.baseUrl : `${connector.baseUrl}/`);
  const target = new URL(operationPath.replace(/^\/+/, ""), base);
  if (target.origin !== base.origin) throw new Error("Connector operations must stay on the approved base URL origin.");
  query.forEach((value, key) => target.searchParams.set(key, value));
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  for (const field of connector.fields) {
    const value = values[field.id];
    if (field.required && !value) throw new Error(`Add the session-only ${field.label} value in External APIs first.`);
    if (!value) continue;
    const finalValue = `${field.prefix ?? ""}${value}`;
    if (field.location === "header") headers[field.key] = finalValue;
    else target.searchParams.set(field.key, finalValue);
  }
  try {
    const { text } = await secureFetch(target.toString(), { method: operation.method, headers, body: operation.method === "POST" ? JSON.stringify(body) : undefined });
    return clip(text);
  } catch (error) {
    let message = error instanceof Error ? error.message : "Connector request failed";
    for (const value of Object.values(values).filter((item) => item.length >= 4)) message = message.replaceAll(value, "[redacted]");
    throw new Error(message);
  }
}

export function availableToolDefinitions(context: ToolContext): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  if (context.allowedTools.includes("web_search")) tools.push({ name: "web_search", description: "Search the public web and return titles, URLs, and snippets.", arguments: { query: "string" } });
  if (context.allowedTools.includes("web_fetch")) tools.push({ name: "web_fetch", description: "Fetch and extract text from one public HTTPS URL. Private networks are blocked.", arguments: { url: "string" } });
  if (context.allowedTools.includes("read_files") && context.attachments.length) tools.push({ name: "read_files", description: `Read chat files by name. Available: ${context.attachments.map((file) => file.name).join(", ")}`, arguments: { name: "string (optional)" } });
  if (context.allowedTools.includes("python")) tools.push({ name: "python", description: "Run bounded Python for calculations and analysis in a network-denied macOS sandbox.", arguments: { code: "string" } });
  for (const connector of context.connectors.filter((item) => item.status === "ready")) {
    for (const operation of connector.operations) {
      tools.push({
        name: connectorToolName(connector, operation.id),
        description: `${connector.name}: ${operation.description}`,
        arguments: Object.fromEntries(operation.parameters.map((parameter) => [parameter.id, `${parameter.label}${parameter.required ? " (required)" : " (optional)"}`])),
      });
    }
  }
  return tools;
}

export async function executeTool(name: string, args: Record<string, unknown>, context: ToolContext) {
  if (name === "web_search") return webSearch(args);
  if (name === "web_fetch") return webFetch(args);
  if (name === "read_files") return readFiles(args, context.attachments);
  if (name === "python") return python(args);
  if (name.startsWith("api_")) return connectorCall(name, args, context);
  throw new Error(`Unknown or unavailable tool: ${name}`);
}
