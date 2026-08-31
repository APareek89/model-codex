# Model Codex Provider QA Inventory

Budget ceiling: **$2 total live provider spend**. All UI/state/error-path checks use local mocks. Live QA is limited to one short Hugging Face prompt and one short Anthropic prompt, with reviewers and memory disabled to prevent extra calls.

| Area | Functional check with user input | Visual/state evidence |
|---|---|---|
| Launch | Open with no credential; no provider request occurs | Chat shell, bottom composer, Model/Agents/External APIs navigation visible |
| HF connection | Enter token, show/hide, connect, populate models, select a model | Selected provider/model is visibly active; key remains masked |
| Anthropic connection | Repeat after an HF error and after an HF success | Provider switch does not retain the wrong error, model, or loading state |
| Chat readiness | Type a prompt after each provider/model selection | Send enables for non-empty input and remains disabled only for empty input or an active run |
| Chat send | Submit with button and Enter | User turn appears immediately; answer or actionable error follows; controls recover after failure |
| Failed send | Simulate invalid key, timeout, and provider 5xx | Prompt is restored, optimistic duplicate is removed, send becomes usable again |
| Provider switching | Connect both providers, switch tabs, select different models, return to chat | Composer model label matches the currently active provider/model |
| Secrets | Clear a key, restart app, inspect durable files | Keys are absent after restart and absent from workspace state/browser storage |
| Persona/cost | Builder selected; reviewer defaults Off; toggle memory Off for live QA | Composer exposes Builder, Reviewer, Memory, and selected model without clipping |
| Agent templates | Open every Council template; verify role, mode, prompt, documents, and tool grants | Builder/reviewer badges and read-only template state are clear |
| Custom agents | Create an agent, edit name/prompt/mode/tools, attach/remove a document, select it in chat | Edits persist across view changes and restart without storing credentials |
| Reviewer flow | Select a reviewer and run a mocked builder → critique → revision turn | Reviewer selection is visible and trace distinguishes the optional review pass |
| Attachments | Attach/remove chat and agent documents; invoke file-read behavior | File chips are visible, removable, scoped, and do not overlap the composer |
| Memory | Toggle memory, exercise periodic publication and checkpoint/trim behavior with mocks | Toggle state, memory trace, and retained recent turns are visible and coherent |
| Research tools | Exercise web search/fetch refusal, attached-file read, Python success, and Python network/personal-file refusal | Tool traces show success/error without freezing chat |
| External APIs | Generate a connector draft from docs, review operations/fields, enter/clear secret, approve, invoke, restart | Manifest persists; secret value does not; draft/ready state is visually distinct |
| Navigation | Exercise Chat, Model, Agents, External APIs, conversation search/new/delete | Each view opens, controls respond, and returning to chat preserves readiness |
| Viewport | Inspect launched 1600×1000 and minimum 1040×700 | No essential control, composer, model list, or provider action is clipped |
| Dense state | Mock a populated model catalog and a multi-message answer with traces | Internal scroll regions remain usable; no overlap or broken layering |

Exploratory cases:

1. HF model discovery fails, then Anthropic connects without restarting the app.
2. A provider connects, its secret is cleared, and chat redirects to Model with an actionable message instead of becoming permanently disabled.
3. Rapid provider/model switching cannot leave the visible model label out of sync with the credential used for inference.
4. Pressing Enter while a run is active cannot create duplicate paid requests.
