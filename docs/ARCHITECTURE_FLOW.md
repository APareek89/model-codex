# Model Codex Desktop — Architecture Flow

The renderer is presentation-only. A narrow typed preload bridge carries validated requests to Electron main, where provider networking, local memory, connector requests, and tool authority are enforced. Credentials exist only in volatile renderer state and are passed request-by-request. Durable data is non-secret and local.

```mermaid
flowchart TD
    U["USER REQUEST<br/>[DATA · React state]<br/>in: prompt, attachments, personas, selected model<br/>out: typed run request"] --> P{"PERMISSION GATE<br/>[FUNCTION · Electron main]<br/>condition: requested tools, files, and connector approved?"}
    P -->|"no"| ASK["VISIBLE CONFIGURATION<br/>[FUNCTION · renderer]<br/>in: missing grant<br/>out: agent toggle, file dialog, or connector approval"]
    ASK -. "updated run state" .-> P
    P -->|"yes"| C["CONTEXT ASSEMBLER<br/>[FUNCTION · agent-runtime.ts]<br/>in: builder, checkpoint, recent turns, retrieved wiki, files<br/>out: stable provider context"]
    C --> L["BUILDER TURN<br/>[AGENT · selected provider/model]<br/>in: context + bounded tool protocol<br/>out: answer or one tool call"]
    L --> T{"TOOL ROUTER<br/>[FUNCTION · tools.ts]<br/>condition: valid enabled tool call?"}
    T -->|"yes"| X["LOCAL TOOL EXECUTION<br/>[LIBRARY · Electron main]<br/>web, HTTPS fetch, attached files, sandboxed Python, approved APIs"]
    X -->|"result or visible error"| L
    T -->|"no"| R{"REVIEW MODE<br/>[FUNCTION]<br/>condition: reviewer enabled?"}
    R -->|"yes"| V["REVIEWER TURN<br/>[AGENT · Council persona]<br/>in: original request + draft<br/>out: bounded critique"]
    V --> Q["REVISION TURN<br/>[AGENT · builder]<br/>in: draft + critique + format contract<br/>out: revised answer"]
    R -->|"no"| O["VISIBLE RESPONSE<br/>[DATA · local conversation]<br/>out: answer + model + tool trace"]
    Q --> O
    O --> M{"COMPACTION GATE<br/>[FUNCTION · memory.ts]<br/>condition: periodic publish or 18+ turn checkpoint?"}
    M -->|"not reached"| U
    M -->|"reached"| K["MEMORY COMPILER<br/>[AGENT + deterministic verifier]<br/>in: raw transcript + previous checkpoint<br/>out: summary + evidence-backed fact proposals"]
    K --> W["LOCAL MEMORY<br/>[DATA · Markdown source + JSON token index]<br/>out: raw JSONL, immutable checkpoints, retrieved wiki pages"]
    W --> U
    E["EXTERNAL CONNECTOR BUILDER<br/>[AGENT + Zod validator]<br/>in: redacted API docs<br/>out: user-approved, same-origin non-secret manifest"] --> T
    S["SESSION SECRET VAULT<br/>[DATA · React memory only]<br/>in: provider + connector credentials<br/>out: request-scoped auth; cleared on quit"] --> L
    S --> X

    classDef agent fill:#dbeafe,stroke:#2563eb,color:#0b2a5b;
    classDef fn fill:#dcfce7,stroke:#16a34a,color:#052e16;
    classDef dec fill:#f3e8ff,stroke:#9333ea,color:#2a0a4a;
    classDef ask fill:#cffafe,stroke:#0891b2,color:#083344;
    classDef data fill:#ede9fe,stroke:#7c3aed,color:#2a0a4a;
    class U,O,W,S data;
    class C,T,R,M,P fn;
    class P,T,R,M dec;
    class ASK ask;
    class L,V,Q,K,E agent;
    class X data;
```

## Gates at a glance

| Gate | Enforcer | Rule |
|---|---|---|
| Tool permission | `electron/agent-runtime.ts` + `electron/tools.ts` | Only agent-enabled tools, attached files, and approved connector operations are exposed. |
| Credential persistence | React session state + storage schema | Secrets are excluded from the durable schema and clear when the app quits. |
| Context compaction | `electron/memory.ts` | Checkpoint after 18 turns and six new turns; periodic fact publication starts after six turns. |
| Long-term publication | Zod schema + exact-evidence verifier | A fact is written only when its quoted evidence occurs verbatim in the transcript. |
| External HTTP | `electron/tools.ts` | HTTPS only; DNS-resolved loopback, link-local, and private targets are rejected, approved public addresses are pinned for the request, and redirects are revalidated. |
| Connector origin | Zod synthesis + `electron/tools.ts` | Documentation is credential-redacted; every operation must remain on the user-approved base origin before session credentials are attached. |
| Python | macOS sandbox profile | Network and personal-volume reads are denied; writes are limited to one temporary directory. |

## File index

| Stage | Files |
|---|---|
| Desktop boundary | `electron/main.ts`, `electron/preload.cts`, `electron/storage.ts` |
| Provider layer | `electron/providers.ts` |
| Agent + review loop | `electron/agent-runtime.ts` |
| Memory compiler/retrieval | `electron/memory.ts` |
| Research and connector tools | `electron/tools.ts` |
| UI and volatile secret state | `src/App.tsx`, `src/styles.css` |

The canonical option-A diagram source is `docs/mermaid/01-desktop-agent-flow.mmd`; `docs/architecture-flow.html` is its standalone viewer. No in-app debug tab is included.
