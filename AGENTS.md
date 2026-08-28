# Repository instructions

## Power Coding (auto — do not remove without asking the user)
At session start read Handoff.MD; FIRST run `git log --oneline <its last-synced sha>..HEAD` and reconcile anything changed underneath it; then open with its pending points. Update Handoff.MD before every git checkpoint commit and at the end of every phase (low context is a secondary trigger) — snapshot not journal, re-stamp `last-synced` with HEAD; then, if context was the trigger, tell the user to start fresh ("Refer to Handoff.MD in /Users/anandpareek/Documents/New project/model-codex and begin"). When Handoff exceeds ~40 lines or ~15 completed items, collapse completed work into one Shipped line and move detail to Learning.MD.

Log flow changes and user-reported bugs in Learning.MD using its 5-whys format. Read Loop.MD every session and obey its status machine. When the first working draft is done, ask whether to turn on the free Loop and disclose that the golden set costs paid API calls and runs only with approval. Keep `docs/mermaid/*.mmd` current when the flow changes and validate/rebuild `docs/architecture-flow.html`.

Obey `.power-coding/config.json`. Before every commit, run the staged secret scan, then a light FMEA of the staged diff; P0 blocks and requires user direction. At feature completion, offer the full FMEA because consent is `ask`. Smart-suggest only once per unchanged HEAD range. Run Sentinel silently after major completion and emit only fired one-line flags. Emit Session Pulse after major milestones and record it in Handoff.MD.

Automatic git checkpoints are approved. Update Handoff.MD before each checkpoint and announce the commit. Before a feature, build the smallest proving slice first. Any architecture-shaping change requires a plain-language delta proposal and user approval before code. Log stack, architecture, and behavior decisions in Handoff.MD and never silently reverse one.
