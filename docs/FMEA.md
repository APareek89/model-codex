# Model Codex v1 — Failure Mode and Effects Analysis

## 🔍 FMEA Analysis — desktop v1

**Analyzed at**: `d0bdf60` (findings true as of this commit; P1s and marked P2s were reconciled against the mitigation work immediately after this commit)

**Scan scope**: 60 files changed, 10,480 additions and 12,165 deletions · **Product context**: private, local-first arm64 Model Codex workspace with volatile credentials (`PRD.md`)

**Failure modes found**: 18 (0 P0, 3 P1, 15 P2)

| # | Component | Failure Mode | Effect | Root Cause | S | O | D | RPN | Priority |
|---|---|---|---|---|---:|---:|---:|---:|---|
| 1 | `electron/storage.ts` | Credential-shaped text pasted into chat, prompts, or documents can enter durable state even though provider-key fields are volatile | Violates the never-persist-credentials invariant for accidental paste paths | Persistence excluded known credential fields but lacked a final content-redaction boundary | 8 | 3 | 7 | 168 | 🟡 P1 |
| 2 | `src/App.tsx`, `electron/memory.ts` | A checkpoint shortens provider context but leaves every raw message in workspace state | Very long sessions eventually cross the 2,000-message schema limit and stop saving | Compaction and durable UI-state pruning were separate flows | 5 | 5 | 6 | 150 | 🟡 P1 |
| 3 | `electron/memory.ts` | A new fact with the same slug is appended without explicitly flagging a contradiction; page truncation can later discard older entries | The model may consume conflicting memory without a visible conflict marker | Exact-evidence validation covered provenance, not supersession state | 6 | 3 | 7 | 126 | 🟡 P1 |
| 4 | `electron/storage.ts` | Any future-version or malformed state field makes load fall back to an empty workspace | Existing local data appears lost until manually recovered | Validation failure has no backup/read-only recovery path | 7 | 2 | 7 | 98 | 🟢 P2 |
| 5 | `electron/tools.ts` | DuckDuckGo changes its public HTML markup or throttles automated requests | Built-in web search returns no results until a connector is configured | Search relies on an undocumented HTML response shape | 4 | 4 | 6 | 96 | 🟢 P2 |
| 6 | `electron/providers.ts` | A provider times out after accepting a billable request and the user retries | The same intent may be billed twice without two answers | Provider calls lack request-status reconciliation or provider idempotency support | 5 | 3 | 6 | 90 | 🟢 P2 |
| 7 | `electron/main.ts` | Prefix-based renderer URL checks accept a custom-scheme hostname that merely starts with the expected text | A future navigation/XSS mistake could receive IPC authority under an over-broad origin check | Trust was compared as a string prefix rather than parsed scheme + host | 7 | 2 | 6 | 84 | 🟢 P2 |
| 8 | `electron/storage.ts` | Two overlapping saves can race on the same temporary path | A recent edit can fail to persist or an older state can win | Debounced renderer saves were not serialized at the main-process write boundary | 6 | 2 | 7 | 84 | 🟢 P2 |
| 9 | `electron/providers.ts` | A catalog includes a model that cannot use the selected text-generation endpoint | The first chat fails after a successful connection | Catalog filtering is heuristic and provider capabilities evolve | 4 | 5 | 4 | 80 | 🟢 P2 |
| 10 | Provider APIs | 429, 5xx, or regional outage rejects generation without a bounded retry | The user must retry manually and may lose time | Only timeouts and visible error normalization are implemented | 5 | 5 | 3 | 75 | 🟢 P2 |
| 11 | `electron/memory.ts` | Rebuilding the entire token index after each publication slows as wiki pages grow | Periodic memory compilation becomes increasingly slow | Index construction is full-scan rather than incremental | 4 | 3 | 5 | 60 | 🟢 P2 |
| 12 | Chat pipeline | Memory enabled by default creates an additional provider call every sixth message | Users can spend more than a one-call mental model suggests | Memory publication is model-assisted rather than deterministic-only | 4 | 5 | 3 | 60 | 🟢 P2 |
| 13 | `electron/storage.ts` | Many 2 MB agent documents can make the JSON state very large | Saves become slow and may exhaust disk or renderer memory | Per-file/per-agent limits exist, but no aggregate workspace quota does | 5 | 2 | 5 | 50 | 🟢 P2 |
| 14 | External API connectors | A model labels a mutating POST as analysis/read-only and the user approves it | A connector can cause an unintended remote mutation | Safety depends partly on generated semantics and human review | 6 | 2 | 4 | 48 | 🟢 P2 |
| 15 | `electron/tools.ts` | Apple Python or `sandbox-exec` behavior differs on another supported macOS/Xcode image | Python is unavailable while the rest of chat works | The tool depends on Apple-shipped runtime paths and sandbox behavior | 5 | 3 | 3 | 45 | 🟢 P2 |
| 16 | Chat IPC | A long provider/tool run cannot be cancelled from the renderer | The user waits for timeout or closes the window | IPC invokes do not yet carry a run ID and abort channel | 4 | 5 | 2 | 40 | 🟢 P2 |
| 17 | `electron/memory.ts` | A model emits invalid memory JSON | That memory cycle is skipped, though the answer is retained | Structured output is prompt-enforced rather than provider-native | 4 | 4 | 2 | 32 | 🟢 P2 |
| 18 | Packaging | Gatekeeper blocks the ad-hoc signed, non-notarized app after download | A friend cannot open it until completing a manual security step | Developer ID signing/notarization is explicitly out of scope | 3 | 4 | 2 | 24 | 🟢 P2 |

### 🔴 P0 — Fix before merge

None.

### 🟡 P1 — Fix this sprint

1. **Closed after `d0bdf60`: add a final redaction boundary** in `electron/secrets.ts`, `electron/storage.ts`, and `electron/main.ts` — provider-shaped and labeled credentials are recursively removed before durable writes and from attached text at ingestion.
2. **Closed after `d0bdf60`: prune state when a checkpoint is accepted** in `src/App.tsx` and align `compactedThrough` in `electron/memory.ts` — the latest ten turns remain as short-term context while the checkpoint carries earlier conversation state.
3. **Closed after `d0bdf60`: surface same-page conflicts and archive oversized history** in `electron/memory.ts` — conflicting updates are marked, prior evidence remains visible, and size rollover writes an immutable local archive.

### 🟢 P2 — Track / next sprint

1. Add a last-known-good state backup and a recovery dialog before supporting schema version 3.
2. Replace or supplement the HTML search adapter with a user-configured stable search API connector.
3. Add provider-aware retry guidance, request IDs where supported, and an explicit warning that a timeout may still be billable.
4. Add capability metadata/allowlists for provider catalog entries and show endpoint incompatibility before chat.
5. Introduce a cancellable run ID across preload, provider requests, web tools, and Python.
6. Add an aggregate workspace/document quota and make the wiki index incremental before large-workspace support.
7. Keep POST connectors visually high-friction and add operation-specific confirmation if mutable API support expands.
8. Exercise Python on macOS 13 and macOS 15 clean machines; keep the documented Command Line Tools fallback.
9. Keep the exact-origin and serialized-save mitigations added after `d0bdf60`; add regression tests when Electron main-process integration tests are introduced.

**Coverage**: 12/12 categories checked. Nothing found in `config_feature_flag_drift`: the packaged application has no production feature flags or credential-bearing environment configuration.
