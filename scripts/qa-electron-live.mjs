import { _electron as electron } from "playwright";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "output", "playwright");
const qaProfile = await mkdtemp(path.join(os.tmpdir(), "model-codex-qa-"));
const credentials = {
  huggingface: process.env.HF_TOKEN?.trim() ?? "",
  anthropic: process.env.ANTHROPIC_API_KEY?.trim() ?? "",
};

if (!credentials.huggingface || !credentials.anthropic) {
  throw new Error("HF_TOKEN and ANTHROPIC_API_KEY are required in the QA environment.");
}

await mkdir(output, { recursive: true });
const childEnvironment = { ...process.env, MODEL_CODEX_QA_USER_DATA: qaProfile };
delete childEnvironment.HF_TOKEN;
delete childEnvironment.ANTHROPIC_API_KEY;
delete childEnvironment.VITE_DEV_SERVER_URL;

const pageErrors = [];
let electronApp;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function connectAndSend(page, test) {
  const workspaceNavigation = page.getByRole("navigation", { name: "Workspace" });
  await workspaceNavigation.getByRole("button", { name: "Model", exact: true }).click();
  await page.locator(".provider-tabs button").filter({ hasText: test.tab }).click();
  const secretInput = page.getByLabel("API key or token");
  await secretInput.fill(credentials[test.provider]);
  check(await secretInput.getAttribute("type") === "password", `${test.tab} credential input is not masked.`);
  await page.getByRole("button", { name: "Connect & load models" }).click();
  const search = page.getByPlaceholder(/Search \d+ models/);
  await search.waitFor({ state: "visible", timeout: 30_000 });
  await search.fill(test.model);
  const modelButton = page.locator(".model-list button").filter({ hasText: test.model }).first();
  await modelButton.waitFor({ state: "visible" });
  await modelButton.click();
  await page.getByRole("button", { name: "Use in chat" }).click();
  check((await page.locator(".model-compact").textContent())?.includes(test.model), `${test.tab} was not marked ready in the composer.`);
  const memory = page.getByRole("checkbox");
  if (await memory.isChecked()) await memory.uncheck();
  const prompt = page.getByLabel("Prompt");
  await prompt.fill("Reply exactly QA_OK");
  const send = page.getByRole("button", { name: "Send" });
  check(await send.isEnabled(), `${test.tab} send button stayed disabled after a valid prompt.`);
  await send.click();
  const assistant = page.locator("article.message.assistant").last();
  await assistant.waitFor({ state: "visible", timeout: 180_000 });
  const response = (await assistant.textContent()) ?? "";
  check(response.includes("QA_OK"), `${test.tab} chat did not return QA_OK.`);
  await page.screenshot({ path: path.join(output, `live-${test.provider}-chat.png`), fullPage: true });
  return { provider: test.provider, model: test.model, response: "QA_OK" };
}

try {
  electronApp = await electron.launch({ args: ["."], cwd: root, env: childEnvironment });
  const page = await electronApp.firstWindow();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.waitForLoadState("domcontentloaded");
  await page.getByText("What should we build in").waitFor({ state: "visible" });

  const results = [];
  results.push(await connectAndSend(page, {
    provider: "huggingface",
    tab: "Hugging Face",
    model: "ibm-granite/granite-4.2-3b",
  }));
  results.push(await connectAndSend(page, {
    provider: "anthropic",
    tab: "Anthropic",
    model: "claude-haiku-4-5-20251001",
  }));
  check(pageErrors.length === 0, `Renderer errors: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, results, pageErrors }, null, 2));
} finally {
  await electronApp?.close().catch(() => undefined);
  if (qaProfile.startsWith(path.join(os.tmpdir(), "model-codex-qa-"))) {
    await rm(qaProfile, { recursive: true, force: true });
  }
}
