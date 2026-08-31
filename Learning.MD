# Learning.MD — Model Codex Desktop
> AGENT: check this before debugging. Add an entry for flow changes, user-reported bugs, or hard-won fixes using the 5-whys format.

### 2026-08-28 — Initial UI did not match the supplied Codex reference

**Symptom:** The first build used a dark dashboard-like workspace and visually centered its empty-state composer, while the user expected the supplied pale Codex desktop shell with a bottom-docked composer.
**Why 1:** The implementation extrapolated from a generic Codex-inspired layout rather than treating the screenshot as the layout authority.
**Why 2:** No screenshot-to-layout acceptance check was established before implementation.
**Why 3:** The original brief emphasized features and model routing more strongly than exact spatial fidelity.
**Deepest why type:** `process`
**Action taken:** The screenshot is now the visual authority in PRD.md and the desktop rewrite has an explicit visual QA gate.
**Preventive action:** For screenshot-matched work, record measurable layout invariants before coding and compare a real render at target viewport sizes.

### 2026-08-28 — Server/client relative times caused hydration failure

**Symptom:** React reported that server text “Now” differed from client text “10m”.
**Why 1:** Relative timestamps were calculated from `Date.now()` during render.
**Why 2:** Server and client rendered at different instants.
**Why 3:** Initial UI state was not deterministic across the SSR boundary.
**Deepest why type:** `code`
**Action taken:** Initial timestamps became stable placeholders and the live clock starts only after hydration.
**Preventive action:** Never use clocks, randomness, locale formatting, storage, or browser-only branches in SSR initial render output.

### 2026-08-31 — Native Electron development window rendered blank

**Symptom:** The Vite preview rendered correctly in Chrome, but Electron showed an empty root element.
**Why 1:** The development Content Security Policy blocked Vite's inline React-refresh preamble.
**Why 2:** Browser-only visual QA did not exercise Electron's response-header policy.
**Why 3:** The development and packaged renderer paths have different script-loading requirements.
**Deepest why type:** `code`
**Action taken:** Development alone permits the Vite refresh preamble; the packaged custom-protocol CSP remains strict and was smoke-tested separately.
**Preventive action:** Every Electron UI milestone must test both the Vite URL and the packaged custom protocol through the actual preload bridge.

### 2026-08-31 — Initial Python sandbox could not launch Apple's runtime

**Symptom:** The Python tool exited by signal before running a simple calculation.
**Why 1:** A deny-by-default profile omitted files and services used by the Xcode Python launcher.
**Why 2:** `/usr/bin/python3` was a launcher rather than the real framework executable.
**Why 3:** The sandbox was designed from assumed runtime paths instead of a minimal execution probe.
**Deepest why type:** `code`
**Action taken:** The tool resolves the Xcode or Command Line Tools executable before sandbox entry, denies network, denies `/Users` and `/Volumes` reads, and limits writes to its temporary directory.
**Preventive action:** Sandbox acceptance now requires both a successful calculation and a failed attempt to read a home-directory file.

### 2026-08-31 — Connector operations needed an origin boundary

**Symptom:** A generated connector operation could contain an absolute URL on a different public origin while the runtime still attached the connector's session credential.
**Why 1:** HTTPS/private-network validation was treated as the complete request boundary.
**Why 2:** The connector base URL and operation path were validated independently, without an invariant joining their origins.
**Deepest why type:** `code`
**Action taken:** Connector documentation is credential-redacted, base URLs cannot carry credentials or query strings, synthesis rejects cross-origin operations, and execution rechecks the same-origin invariant before adding secrets. DNS-approved public addresses are pinned for every request and redirect.
**Preventive action:** Every credential-bearing integration must validate both destination reachability and credential scope immediately before dispatch.

### 2026-08-31 — Optional post-processing could discard a successful draft

**Symptom:** A reviewer or local-memory write failure could reject a run after the provider had already produced a usable, billable builder answer; retrying could also duplicate the optimistic user turn.
**Why 1:** Optional stages shared the primary generation failure path.
**Why 2:** Optimistic UI state was restored incompletely on rejection.
**Deepest why type:** `flow`
**Action taken:** Reviewer and memory failures now become visible trace errors while preserving the builder draft, and failed sends remove the optimistic message before restoring the prompt.
**Preventive action:** Mark every pipeline stage as required or best-effort; a best-effort failure must not erase a completed required stage.

### 2026-08-31 — Persisted model labels overstated live chat readiness

**Symptom:** After entering an HF or Anthropic credential and selecting a model, chat could appear unusable or show a model that was not actually connected for the current process.
**Why 1:** The selected provider/model IDs were persisted, while credentials and live catalogs correctly cleared on quit.
**Why 2:** The composer treated the persisted IDs alone as “ready” and offered no direct transition back to chat after a fresh selection.
**Why 3:** Editing or clearing a credential did not invalidate the catalog loaded by the previous credential, and an in-flight request could finish after the user switched providers.
**Why 4:** QA covered the provider adapters but did not previously encode the full credential → catalog → explicit selection → composer readiness state machine.
**Deepest why type:** `flow`
**Action taken:** Readiness now requires a current in-memory credential plus a validated catalog containing the selected model; key edits and provider switches invalidate stale work, selection is explicit, and “Use in chat”/“Connect model” actions make the transition unambiguous.
**Preventive action:** Every session-only capability must have an end-to-end test that starts from durable-but-secretless state, changes credentials mid-request, and verifies the exact UI readiness signal before dispatch.
