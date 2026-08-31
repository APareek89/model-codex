# Handoff.MD — Model Codex Desktop
last-synced: `d0bdf60`
> AGENT: read this fully at session start. FIRST run `git log --oneline d0bdf60..HEAD` and reconcile drift.
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
- ✅ Full 12-category FMEA at `d0bdf60` is recorded in `docs/FMEA.md`; all three P1s were closed by durable-write redaction, real checkpoint pruning, and conflict-marked/archive-safe memory.
- ✅ Exact renderer-origin matching and serialized atomic state saves close two additional P2s from the full scan.
- ✅ Screenshot render, native development bridge, final packaged custom protocol, Python isolation, arm64 architecture, app and mounted-DMG signatures, and DMG checksum were smoke-tested.
- ✅ Final artifact: `release/Model-Codex-0.2.0-mac-arm64.dmg` (128 MB, SHA-256 `8fce3308c495806465852c813982d5769b911caab37ddb97bc5de5624a1e8d7b`).
- ✅ Ten unit tests, lint, type-check, build, Mermaid validation, local/package secret invariants, staged secret scan, and production dependency audit pass.

## Pending points
- 🧑 USER: Add personal provider/API credentials in the app after each restart by design.
- 🧑 USER: Decide whether to turn on the free Power Coding Loop; paid golden evals remain approval-only.

## Decisions
- 2026-08-28 — Credentials are volatile and never persisted; there is no `.env` credential path.
- 2026-08-28 — Markdown is long-term memory source of truth; JSON token search is rebuildable.
- 2026-08-28 — Agent Council source is `/Users/anandpareek/Documents/market-research-agents`.
- 2026-08-28 — Only option-A Mermaid + standalone viewer; no in-app debug tab.
- 2026-08-31 — Provider-agnostic bounded JSON tool protocol gives every selected LLM the same local tools.
- 2026-08-31 — Apple Silicon DMG is ad-hoc signed only; no Developer ID, notarization, or updater.

**Session efficiency:** 🎯 ~60% feature · 🔧 ~33% support/verification · 🔁 ~7% rework
