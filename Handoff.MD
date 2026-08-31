# Handoff.MD — Model Codex Desktop
last-synced: `1036b67`
> AGENT: read this fully at session start. FIRST run `git log --oneline 1036b67..HEAD` and reconcile drift.
> Update before every checkpoint commit, at phase end, and on low-context signals. Rewrite as a snapshot, re-stamp from HEAD, and keep under ~40 lines / ~15 completed items.
> Git checkpoints are automatic. Run the staged secret scan and configured light FMEA before every commit.

## Compact summary of previous session
The hosted vinext prototype was replaced by the approved local Electron/Vite/React/TypeScript arm64 app. The pale Codex reference UI now has a bottom composer plus Model, Agents, and External APIs workspaces.

## Current state
- ✅ Electron main/preload boundary uses context isolation, sandboxing, trusted-sender checks, strict production CSP, and a custom local protocol.
- ✅ Hugging Face, OpenAI, Anthropic, and Google credentials are React-memory-only; live model discovery and provider inference are wired.
- ✅ Agent Council ships Scout, Astra, Vera, Vera Expert, Cleo, and Cleo Expert with builder → reviewer → revision flow.
- ✅ Local tools cover web search/fetch, attached files, approved API connectors, and macOS-sandboxed Python.
- ✅ LLM-Wiki memory writes redacted raw JSONL, verified Markdown facts, a rebuildable JSON index, and immutable compaction checkpoints.
- ✅ External API docs become Zod-validated draft manifests; the user approves operations and re-enters secret values each launch.
- ✅ Pre-commit FMEA closed cross-origin credential forwarding, DNS rebinding, duplicate retry, hidden reviewer-cost, and optional-stage failure paths; no P0/P1 remains in the light scan.
- ✅ Screenshot render, native development bridge, packaged custom protocol, Python isolation, arm64 architecture, app signature, and DMG checksum were smoke-tested.
- ✅ Eight unit tests, lint, type-check, build, Mermaid validation, staged secret scan, and production dependency audit pass.

## Pending points
- 🤖 Commit the completed desktop slice after the final staged secret/sentinel pass.
- 🤖 Run feature-complete/full FMEA, final `npm run dist`, mount-test the final DMG, and verify the no-secret state invariant.
- 🤖 Refresh final Handoff stamp and commit the release-ready state.
- 🧑 USER: Add personal provider/API credentials in the app after each restart by design.

## Decisions
- 2026-08-28 — Credentials are volatile and never persisted; there is no `.env` credential path.
- 2026-08-28 — Markdown is long-term memory source of truth; JSON token search is rebuildable.
- 2026-08-28 — Agent Council source is `/Users/anandpareek/Documents/market-research-agents`.
- 2026-08-28 — Only option-A Mermaid + standalone viewer; no in-app debug tab.
- 2026-08-31 — Provider-agnostic bounded JSON tool protocol gives every selected LLM the same local tools.
- 2026-08-31 — Apple Silicon DMG is ad-hoc signed only; no Developer ID, notarization, or updater.

**Session efficiency:** 🎯 ~62% feature · 🔧 ~28% support/verification · 🔁 ~10% rework
