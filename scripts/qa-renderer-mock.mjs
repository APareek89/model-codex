/* global window */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "output", "playwright");
const target = process.env.MODEL_CODEX_QA_URL || "http://127.0.0.1:5173";
await mkdir(output, { recursive: true });

function check(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript({ path: path.join(root, "scripts", "qa-browser-init.js") });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.getByText("What should we build in").waitFor({ state: "visible" });
  const navigation = page.getByRole("navigation", { name: "Workspace" });
  const prompt = page.getByLabel("Prompt");
  const send = page.getByRole("button", { name: "Send" });

  await prompt.fill("Needs a connected model");
  await send.click();
  await page.getByRole("heading", { name: "Model", exact: true }).waitFor();
  await page.getByRole("button", { name: "Back to chat" }).click();
  check(await prompt.inputValue() === "Needs a connected model", "Disconnected send did not preserve the prompt.");
  await navigation.getByRole("button", { name: "Model", exact: true }).click();

  // Provider failure recovery, successful selection, and chat readiness.
  await page.getByLabel("API key or token").fill("hf-ok");
  await page.getByRole("button", { name: "Connect & load models" }).click();
  await page.locator(".provider-tabs button").filter({ hasText: "Anthropic" }).click();
  await page.waitForTimeout(80);
  check(await page.locator(".model-list").count() === 0, "A completed HF request leaked models into the newly selected provider.");
  await page.locator(".provider-tabs button").filter({ hasText: "Hugging Face" }).click();
  await page.getByLabel("API key or token").fill("hf-fail");
  await page.getByRole("button", { name: "Connect & load models" }).click();
  await page.getByText("QA: Hugging Face rejected this token.").waitFor();
  await page.locator(".provider-tabs button").filter({ hasText: "Anthropic" }).click();
  check(await page.locator(".form-error").count() === 0, "HF error leaked into the Anthropic tab.");
  await page.getByLabel("API key or token").fill("anth-ok");
  await page.getByRole("button", { name: "Connect & load models" }).click();
  await page.locator(".model-list button").filter({ hasText: "claude-mock" }).click();
  await page.getByRole("button", { name: "Use in chat" }).click();
  check((await page.locator(".model-compact").textContent())?.includes("claude-mock"), "Composer model label did not update.");

  await prompt.fill("Mock reviewer and memory check");
  await page.locator(".agent-select.reviewer select").selectOption({ label: "Vera" });
  check(await send.isEnabled(), "Send remained disabled with a valid model and prompt.");
  await send.click();
  await page.locator("article.message.assistant").waitFor();
  check(await page.locator(".trace-list").getByText("Vera", { exact: true }).isVisible(), "Reviewer trace was not visible.");
  check(await page.locator(".trace-list").getByText("memory compaction", { exact: true }).isVisible(), "Memory trace was not visible.");
  await page.screenshot({ path: path.join(output, "mock-chat-reviewer.png"), fullPage: true });

  // Failed sends restore the prompt and release the sending state.
  await navigation.getByRole("button", { name: "Model", exact: true }).click();
  await page.getByLabel("API key or token").fill("send-fail");
  check(await page.locator(".model-list").count() === 0, "Changing a credential did not invalidate its old model catalog.");
  await page.getByRole("button", { name: "Connect & load models" }).click();
  await page.locator(".model-list button").filter({ hasText: "claude-mock" }).click();
  await page.getByRole("button", { name: "Use in chat" }).click();
  await prompt.fill("Restore this prompt");
  await send.click();
  await page.getByText("QA: provider request failed.").waitFor();
  check(await prompt.inputValue() === "Restore this prompt", "Failed send did not restore the prompt.");
  check(await send.isEnabled(), "Failed send left the send button disabled.");

  // Agent templates, search, editable copies, tools, and documents.
  await navigation.getByRole("button", { name: "Agents", exact: true }).click();
  const search = page.getByPlaceholder("Search agents");
  await search.fill("Cleo Expert");
  check(await page.locator(".agent-list-panel > button").count() === 1, "Agent search did not filter templates.");
  await page.locator(".agent-list-panel > button").click();
  await page.getByRole("button", { name: "Duplicate" }).click();
  await page.getByLabel("Name").fill("QA Reviewer");
  check(await page.locator(".form-grid label").filter({ hasText: "Mode" }).locator("select").inputValue() === "reviewer", "Duplicated reviewer did not retain its mode.");
  await page.getByRole("button", { name: "Add documents" }).click();
  await page.getByText("qa.txt", { exact: true }).waitFor();
  await page.getByText("qa.txt", { exact: true }).locator("..").getByRole("button").click();
  check(await page.getByText("qa.txt", { exact: true }).count() === 0, "Agent document could not be removed.");
  await page.screenshot({ path: path.join(output, "mock-agents.png"), fullPage: true });

  // Connector generation, explicit approval, session-only secret, and durable metadata.
  await navigation.getByRole("button", { name: "External APIs", exact: true }).click();
  await page.getByLabel("Name").fill("QA Analytics");
  await page.getByLabel("Base URL (optional)").fill("https://api.example.com/");
  await page.getByLabel("API documentation").fill("GET /v1/events returns analytics events. Authorization uses a bearer API key.");
  await page.getByRole("button", { name: "Generate connector draft" }).click();
  await page.getByText("List events", { exact: true }).waitFor();
  await page.getByLabel("API key").fill("fixture-value");
  check(await page.getByLabel("API key").getAttribute("type") === "password", "Connector secret input is not masked.");
  await page.getByRole("button", { name: "Approve tools for chat" }).click();
  await page.getByText("ready", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "mock-external-apis.png"), fullPage: true });
  await page.waitForTimeout(350);
  const durableState = await page.evaluate(() => window.modelCodex.loadState());
  check(JSON.stringify(durableState).includes("QA Analytics"), "Connector manifest was not saved.");
  check(!JSON.stringify(durableState).includes("fixture-value"), "Connector secret leaked into durable state.");
  check(await page.evaluate(() => localStorage.length + sessionStorage.length) === 0, "Browser storage contains unexpected app state.");

  const workspaceSidebarToggle = page.locator(".workspace-chrome").getByRole("button", { name: "Toggle sidebar" });
  await workspaceSidebarToggle.click();
  await page.waitForTimeout(220);
  check((await page.locator(".app-shell").getAttribute("class"))?.includes("sidebar-collapsed"), "Sidebar collapse control did not collapse the sidebar.");
  await workspaceSidebarToggle.click();
  await page.waitForTimeout(220);
  check(!(await page.locator(".app-shell").getAttribute("class"))?.includes("sidebar-collapsed"), "Collapsed sidebar could not be reopened from the workspace.");

  // Minimum supported viewport keeps primary actions reachable.
  await page.setViewportSize({ width: 1040, height: 700 });
  await navigation.getByRole("button", { name: "Model", exact: true }).click();
  check(await page.getByRole("button", { name: "Connect & load models" }).isVisible(), "Model connection action is clipped at minimum viewport.");
  await page.screenshot({ path: path.join(output, "mock-minimum-viewport.png"), fullPage: true });
  check(pageErrors.length === 0, `Renderer errors: ${pageErrors.join(" | ")}`);

  console.log(JSON.stringify({ ok: true, pageErrors, screenshots: [
    "mock-chat-reviewer.png",
    "mock-agents.png",
    "mock-external-apis.png",
    "mock-minimum-viewport.png",
  ] }, null, 2));
} finally {
  await browser.close();
}
