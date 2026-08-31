# Model Codex

Model Codex is a private, local-first macOS workspace with a Codex-style chat UI, live multi-provider model selection, Agent Council personas, local memory, research tools, and user-defined API connectors.

It is built only for Apple Silicon (`arm64`) on macOS 13 or newer. There is no Windows or Intel build, hosted backend, telemetry, analytics, license check, auto-updater, code signing identity, or notarization.

## Install a shared DMG

1. Open the downloaded `Model-Codex-<version>-mac-arm64.dmg`.
2. Drag **Model Codex** into **Applications**.
3. Because this personal build is ad-hoc signed and not notarized, run:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Model Codex.app"
   ```

4. Open **Model Codex** from Applications.

On macOS 15 or newer, you may instead need to try opening the app once, then use **System Settings → Privacy & Security → Open Anyway**.

## First run: add your own model key

Open the **Model** tab, choose Hugging Face, OpenAI, Anthropic, or Google, paste your own key, and select **Connect & load models**. The app requests the live model catalog for that credential; choose the model you want to use in chat.

Provider keys and External API secrets exist only in volatile application memory. They are never written to the local state file, Markdown memory, logs, `.env`, cookies, `localStorage`, or `sessionStorage`, and they clear when the app quits. Recognizable provider-shaped and labeled credentials pasted into chat, connector documentation, or attached text are also redacted at ingestion and again before durable writes. You must reconnect after every restart. Chat content and credentials are still sent to the provider you explicitly select in order to perform inference.

## What stays on the Mac

- Chats, non-secret model selection, agents, attached agent documents, and connector manifests are stored in `~/Library/Application Support/Model Codex/`.
- Short-term context stays in the active run. Longer conversations receive compact conversational checkpoints; after a checkpoint, the latest ten messages remain alongside the summary instead of allowing workspace state to grow forever.
- Durable facts are proposed by the selected model, verified against exact conversation evidence, and published as local Markdown pages with immutable compaction checkpoints.
- Connector definitions persist locally, but their key values do not.

Deleting the `~/Library/Application Support/Model Codex/` folder resets all local app data. Do this only when you intentionally want to remove chats, agents, connector definitions, and memory.

## Agent Council and tools

The built-in templates come from the approved Agent Council: Scout and Astra are builders; Vera, Vera Expert, Cleo, and Cleo Expert are reviewers. Builders become the cached system prompt for chat. Reviewers are off by default; when one is enabled, it critiques the builder output and the builder produces a constraint-preserving revision. Memory compilation and an enabled reviewer can make additional calls to the selected model.

Agents can be granted public web search, HTTPS fetch, attached-file reading, and bounded Python. Python runs through Apple's local Python runtime with network access denied, `/Users` and `/Volumes` reads denied, and writes limited to a temporary directory. If Python is unavailable, install Apple Command Line Tools:

```bash
xcode-select --install
```

External APIs are created by pasting API documentation. The selected model proposes a least-privilege manifest containing only GET/POST operations; the user must review and approve it before those tools become available to chat. Private-network targets and non-HTTPS URLs are blocked.

## Develop and build

Requirements: macOS 13+, Apple Silicon, Node.js 22.13 or newer, Xcode Command Line Tools, and npm.

```bash
npm ci
npm run dev
```

For isolated local provider QA only, use the git-ignored file [`.env.qa.example`](./.env.qa.example) as the template:

```bash
cp .env.qa.example .env.qa
# Add HF_TOKEN and ANTHROPIC_API_KEY to .env.qa, then run:
npm run qa:live
```

`.env.qa` is read only by the QA runner. The application itself never reads or bundles environment files; normal users always enter their own credentials in the **Model** tab.

Available scripts:

- `npm run dev` — Vite renderer plus Electron development app.
- `npm run build` — type-check and create renderer/main/preload production output.
- `npm test` — unit tests for provider adapters and tool boundaries.
- `npm run qa:live` — build and run one isolated, minimal HF + Anthropic Electron smoke test from `.env.qa`.
- `npm run dist` — build, package the arm64 DMG, ad-hoc sign the `.app`, and verify the signature.

The finished artifact is written to `release/Model-Codex-<version>-mac-arm64.dmg`. The packaged application is also available at `release/mac-arm64/Model Codex.app`.

The packaging configuration intentionally uses one target and architecture: DMG + arm64, with `hardenedRuntime = false`, `gatekeeperAssess = false`, and `identity = null`. The `afterPack` hook signs the application with:

```bash
codesign --force --deep --sign - "release/mac-arm64/Model Codex.app"
```
