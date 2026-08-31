# Handoff.MD — Model Codex Desktop
last-synced: `b5b9007`
> AGENT: read this fully at session start. FIRST run `git log --oneline b5b9007..HEAD` and reconcile drift.
> Update before every checkpoint commit, at phase end, and on low-context signals. Rewrite as a snapshot, re-stamp from HEAD, and keep under ~40 lines / ~15 completed items.
> Git checkpoints are automatic. Run the staged secret scan and configured light FMEA before every commit.

## Compact summary of previous session
The Electron arm64 app now has a QA-verified provider readiness flow, Agents workbench, local memory/tools, and External API connectors in the approved Codex-style shell.

## Current state
- ✅ Electron main/preload boundary uses context isolation, sandboxing, trusted-sender checks, strict production CSP, and a custom local protocol.
- ✅ Hugging Face, OpenAI, Anthropic, and Google credentials are React-memory-only; live model discovery and provider inference are wired.
- ✅ Agent Council ships Scout, Astra, Vera, Vera Expert, Cleo, and Cleo Expert with builder → reviewer → revision flow.
- ✅ Local tools cover web search/fetch, attached files, approved API connectors, and macOS-sandboxed Python.
- ✅ LLM-Wiki memory writes redacted raw JSONL, verified Markdown facts, a rebuildable JSON index, and immutable compaction checkpoints.
- ✅ External API docs become Zod-validated draft manifests; the user approves operations and re-enters secret values each launch.
- ✅ Session readiness requires a current key + loaded catalog + explicit selection; stale key/catalog requests are invalidated and the Model/chat transition is direct.
- ✅ Agent search/duplication/docs, valid builder/reviewer modes, failed-send recovery, sidebar recovery, and connector secret non-persistence have automated UI coverage.
- ✅ Real HF and Anthropic catalog + inference passed in isolated Electron profiles; live spend stayed far below the approved $2 limit.
- ✅ Local web search/fetch, attachment reads, Python calculation, and sandbox refusal of personal files passed live tool probes.
- ✅ 17 tests, lint, type-check, production build, 1600×1000/minimum-viewport screenshots, and zero production dependency vulnerabilities pass.
- ✅ Final artifact: `release/Model-Codex-0.2.1-mac-arm64.dmg` (128 MB, SHA-256 `6c870c7726c0a349f42641981d64840e40dde3166516b1ab36862f63a4cdca72`).
- ✅ The app and mounted DMG are arm64, macOS 13+, ad-hoc signed, checksum-valid, and exclude `.env.qa` plus both tested credentials.

## Pending points
- 🧑 USER: Install 0.2.1 and add personal provider/API credentials in the app after each restart by design.
- 🧑 USER: Decide whether to turn on the free Power Coding Loop; paid golden evals remain approval-only.

## Decisions
- 2026-08-28 — Credentials are volatile and never persisted by the app.
- 2026-08-31 — `.env.qa` is a git-ignored, unbundled test-runner input only; production continues to use Model-tab session memory.
- 2026-08-28 — Markdown is long-term memory source of truth; JSON token search is rebuildable.
- 2026-08-28 — Agent Council source is `/Users/anandpareek/Documents/market-research-agents`.
- 2026-08-28 — Only option-A Mermaid + standalone viewer; no in-app debug tab.
- 2026-08-31 — Provider-agnostic bounded JSON tool protocol gives every selected LLM the same local tools.
- 2026-08-31 — Apple Silicon DMG is ad-hoc signed only; no Developer ID, notarization, or updater.

**Session efficiency:** 🎯 ~34% feature · 🔧 ~54% support/verification · 🔁 ~12% rework — isolated real-provider QA found a UI state-machine defect, not an adapter defect.
