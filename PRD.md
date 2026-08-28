# PRD — Model Codex Desktop

## Product

Model Codex is a private, local-first macOS desktop workspace that recreates the supplied Codex UI: a pale fixed sidebar, a large quiet workspace, and a prompt composer docked near the bottom of the chat window. It adds model routing, configurable agents, durable context, research tools, and modular external API connectors.

## User and job

The primary user is Anand and a small group of friends on Apple Silicon Macs. They use the app to research, analyse files and web sources, write or review work with reusable personas, and chat through their own Hugging Face, OpenAI, Anthropic, or Google credentials.

## Required capabilities

- Native Electron + Vite + React + TypeScript application for macOS 13+ and arm64 only.
- Model tab for session-only credentials, live model discovery, and per-chat model selection.
- Agents tab for templates, custom system prompts, attached reference documents, tool permissions, and Builder or Reviewer mode.
- Initial templates derived from `/Users/anandpareek/Documents/market-research-agents`: Scout, Astra, Vera, Vera Expert, Cleo, and Cleo Expert.
- LLM-Wiki-inspired memory: active short-term messages, immutable conversational checkpoints with recent increments, and durable long-term Markdown knowledge pages backed by a rebuildable local search index.
- Context compaction that preserves the user's goal, decisions, constraints, open loops, evidence links, and selected persona/tool state.
- Tools for web search, web fetch, permission-scoped file reading, and sandboxed Python analysis.
- External APIs tab with reusable connector manifests. Users can upload API documentation; a selected model proposes credential/configuration fields and tool schemas for user approval.
- All chats, memories, agents, non-secret connector definitions, and indexes stay on the user's Mac. Provider/API credentials are memory-only and never written to disk.
- No hosted backend, telemetry, analytics, licensing, auto-update, code signing identity, or notarization.

## Safety and trust invariants

- Renderer code never receives unrestricted Node, shell, or filesystem access.
- Every tool call is schema-validated, scoped, visible in the activity trace, cancellable where possible, and limited to explicit user-granted paths or hosts.
- Secrets are redacted from logs, memory compilation, exports, and error text; restarting the app clears every credential.
- Web/API connectors default to HTTPS and block loopback, link-local, private-network, and metadata-service targets unless a future explicit local-connector mode is designed.
- Long-term memory pages retain evidence pointers and never silently overwrite contradictory facts; conflicts are surfaced or quarantined.

## Done for v1

An arm64 DMG installs and launches on macOS 13+ after the documented quarantine command. A user can enter an HF token, load/select a model, choose an Agent Council Builder persona, attach a file, run a chat that may use approved web/file/Python tools, compact the conversation, close/reopen the app with chats and non-secret memory intact, then reconnect the token and continue. Reviewer mode can critique and revise a generated answer. External API documentation can produce a saved non-secret connector whose credential must be re-entered per launch.

## Out of scope

Windows, Intel/x64, Mac App Store, Apple Developer ID signing, notarization, auto-updates, public hosting, remote sync, multi-user accounts, background cloud workers, autonomous shell access, and persistent credentials.
