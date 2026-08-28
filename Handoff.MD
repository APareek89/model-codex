# Handoff.MD — Model Codex Desktop
last-synced: `76bf7fb`
> AGENT: read this fully at session start. FIRST run `git log --oneline 76bf7fb..HEAD` and reconcile drift.
> Update before every checkpoint commit, at phase end, and on low-context signals. Rewrite as a snapshot, re-stamp from HEAD, and keep under ~40 lines / ~15 completed items.
> Git checkpoints are automatic. Run the staged secret scan and configured light FMEA before every commit.

## Compact summary of previous session
The initial vinext web app implemented multi-provider chat and fixed an SSR hydration mismatch. The user then approved a full local Electron rewrite matching the supplied light Codex screenshot, with Agent Council personas, LLM Wiki memory, tools, external connectors, and arm64 DMG packaging.

## Current state
- ✅ Working vinext app preserved at checkpoint `76bf7fb`.
- ✅ Product/architecture approved: Electron main + narrow preload + React renderer; no hosted backend.
- ✅ Agent template source confirmed: `/Users/anandpareek/Documents/market-research-agents`.
- ✅ Power Coding setup installed; master Mermaid validates and standalone viewer is generated.
- ▶ Next phase: migrate the preserved web checkpoint to the approved Electron foundation.

## Pending points
- 🤖 Replace vinext with Electron + Vite + React + TypeScript and reproduce the target UI.
- 🤖 Implement provider, memory, agents, tools, and connector lanes in smallest working vertical slices.
- 🤖 Package and smoke-test an ad-hoc-signed macOS arm64 DMG.
- 🤖 Offer the Loop when the first desktop core path works end-to-end.
- 🧑 USER: Re-enter personal credentials after every app restart by design.

## Decisions
- 2026-08-28 — Credentials are memory-only, never persisted — privacy requirement; restart requires reconnecting.
- 2026-08-28 — LLM Wiki uses Markdown as source of truth plus a rebuildable local index — inspectable, portable memory.
- 2026-08-28 — Tool authority lives in Electron main behind typed preload IPC — renderer compromise must not imply machine access.
- 2026-08-28 — Agent Council seeds Scout, Astra, Vera, Vera Expert, Cleo, and Cleo Expert — user-approved source.
- 2026-08-28 — Debugging uses Mermaid files + standalone viewer only — user selected option A.
- 2026-08-28 — Electron Builder targets one unsigned/ad-hoc-signed arm64 DMG — personal sharing only.

**Session efficiency:** 🎯 ~45% feature · 🔧 ~45% support (architecture/source discovery and Power Coding bootstrap) · 🔁 ~10% rework
