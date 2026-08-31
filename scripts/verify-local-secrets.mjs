import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { redactSecrets } from "../dist-electron/electron/secrets.js";

const root = process.argv[2];
if (!root) throw new Error("Usage: node scripts/verify-local-secrets.mjs <application-support-directory>");

async function filesBelow(directory, filter = () => true) {
  try {
    const entries = await readdir(directory, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && filter(entry.name)).map((entry) => path.join(entry.parentPath, entry.name));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

const statePath = path.join(root, "workspace-state.json");
const durableFiles = [statePath, ...await filesBelow(path.join(root, "memory"), (name) => /\.(json|jsonl|md)$/.test(name))];
const forbiddenKeys = [];
let durableScanned = 0;

for (const file of durableFiles) {
  const content = await readFile(file, "utf8").catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (content === null) continue;
  durableScanned += 1;
  if (redactSecrets(content) !== content) throw new Error(`Credential-shaped text found in app-owned durable file: ${path.basename(file)}`);
  if (file !== statePath) continue;
  const state = JSON.parse(content);
  const walk = (value, trail = "state") => {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (/^(apiKey|token|credential|connectorSecrets|sessionSecrets)$/i.test(key)) forbiddenKeys.push(`${trail}.${key}`);
      walk(item, `${trail}.${key}`);
    }
  };
  walk(state);
}

if (forbiddenKeys.length) throw new Error(`Forbidden durable credential fields: ${forbiddenKeys.join(", ")}`);

const browserFiles = [
  ...await filesBelow(path.join(root, "Local Storage")),
  ...await filesBelow(path.join(root, "Session Storage")),
];
const shapedCredential = /hf_[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{16,}/;
for (const file of browserFiles) {
  const content = (await readFile(file)).toString("latin1");
  if (shapedCredential.test(content)) throw new Error(`Credential-shaped value found in browser storage: ${path.basename(file)}`);
}

console.log(`Local secret invariant: clean (${durableScanned} app-owned text files, ${browserFiles.length} browser-storage files scanned).`);
