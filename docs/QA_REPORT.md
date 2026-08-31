# Model Codex 0.2.1 QA Report

Date: 2026-08-31

Outcome: **PASS** for the current feature set, with the provider-specific coverage limits noted below.

## Fixed in this release

- Chat readiness now requires the current process to hold the provider credential and a validated catalog containing the selected model. A persisted model name can no longer masquerade as a live connection after restart.
- Editing/clearing a credential invalidates its old catalog and selection. Switching providers invalidates an in-flight catalog request so late results cannot leak into the wrong tab.
- Model selection is explicit and ends with **Use in chat**. The composer shows **Connect model** until the selected model is actually ready, and its model control reopens setup.
- A failed send restores the prompt, removes the optimistic duplicate, and releases the send control.
- Agent Builder/Reviewer preferences are reconciled by mode. Agent search works, Council templates can be duplicated into editable copies, and reference document add/remove is covered.
- The collapsed sidebar can be reopened. Decorative/unimplemented controls are disabled instead of pretending to work.

## Provider and chat results

| Check | Result |
|---|---|
| HF credential → live catalog | PASS — 135 models returned |
| Anthropic credential → live catalog | PASS — 10 models returned |
| Direct HF completion | PASS — `ibm-granite/granite-4.2-3b` returned `QA_OK` |
| Direct Anthropic completion | PASS — `claude-haiku-4-5-20251001` returned `QA_OK` |
| Isolated Electron HF selection → send → rendered answer | PASS |
| Isolated Electron Anthropic selection → send → rendered answer | PASS |
| Empty prompt / active request send lock | PASS |
| Provider failure → prompt restore → retry readiness | PASS |
| Rapid provider switch during catalog load | PASS |

Ten tiny live calls were made across diagnosis, readiness repair, isolated-profile safety validation, and final-build confirmation. The adapters do not return provider billing to the UI, so the provider dashboards remain authoritative; given the tiny prompts and `QA_OK` outputs, estimated spend was well below $0.01 and safely under the authorized $2 ceiling.

OpenAI and Google were exercised through adapter-level mocked API responses and renderer catalogs, not live billing accounts, because no keys for those providers were supplied.

## Agents, memory, tools, and APIs

| Area | Result |
|---|---|
| Six approved Agent Council templates and builder/reviewer routing | PASS |
| Builder → reviewer → revision runtime | PASS (mocked provider, three distinct calls) |
| Agent search, duplicate/edit/mode, reference add/remove | PASS |
| Short-term chat context and periodic long-term publication | PASS |
| Evidence-backed wiki fact and immutable compaction checkpoint | PASS |
| Web search and HTTPS fetch | PASS with live public endpoints |
| Attached-file read | PASS |
| Python calculation | PASS |
| Python personal-file read and private-network fetch refusal | PASS |
| External API draft, operation review, approval, and session secret | PASS with mocked synthesis |
| Connector secret absent from durable renderer state | PASS |

No real third-party connector call was made because no PostHog/Paddle/GA4 credential was provided. Connector schema generation, approval, same-origin enforcement, credential scoping, and error redaction are covered by integration/unit tests.

## UI and package verification

- Automated Chromium sweep: 1600×1000 and minimum 1040×700, zero renderer exceptions.
- Visual evidence: `output/playwright/mock-chat-reviewer.png`, `mock-agents.png`, `mock-external-apis.png`, and `mock-minimum-viewport.png`.
- Test suite: 17/17 passed; lint, TypeScript, and production build passed.
- Production dependency audit: 0 vulnerabilities. Development-only audit retains three transitive high-severity advisories in build tooling; none ship in the application.
- Packaged binary: arm64 only, macOS minimum 13.0, valid ad-hoc deep signature.
- DMG verified after mount: `release/Model-Codex-0.2.1-mac-arm64.dmg`.
- SHA-256: `6c870c7726c0a349f42641981d64840e40dde3166516b1ab36862f63a4cdca72`.
- Package secret invariant: `.env.qa`, the QA scripts, and both tested credential values are absent from `app.asar`.

## Local QA credential file

Use `.env.qa.example` to create `.env.qa` in the project root. `.env.qa` is git-ignored, never read by the app, and never bundled. Normal use always enters keys in the Model tab, where they remain in memory only until the process quits.
