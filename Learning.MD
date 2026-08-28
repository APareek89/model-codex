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
