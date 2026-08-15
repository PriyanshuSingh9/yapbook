# Yapbook — Decision Log

> Architectural decisions, recorded ADR-style (short) so the _why_ survives the _what_.
> New decisions **append**; existing ones get **superseded**, never silently edited.
> The tables in [architecture.md §3](architecture.md#3-technology-decisions) and [milestones.md — Waterfall Decisions](milestones.md#waterfall-decisions-made-once-inherited-by-everything) summarize the same choices.

## How to record a new decision

If a choice has more than one viable option, it's a decision — record it here. A good rule of thumb: **if you explain "why we use X" more than once, it belongs in this log.**

Template:

```markdown
## D-XXX — Title

- **Status:** Accepted · Superseded by D-YYY · Rejected
- **Date:** YYYY-MM-DD

**Context:** what problem forced the choice?

**Decision:** what did we choose?

**Alternatives rejected:** what else was considered, and why not?

**Consequences:** what does this decision require downstream, and when should it be revisited?
```

---

## D-001 — Desktop framework: Tauri v2

- **Status:** Accepted
- **Date:** Project kickoff

**Context:** we ship a native desktop app that handles private chat data. Installer size, RAM footprint, and IPC security all matter.

**Decision:** Tauri v2.

**Alternatives rejected:** Electron — 150 MB+ binary and a weaker capability-based security model for IPC.

**Consequences:** Rust core + OS webview frontend; every plugin and permission is gated by capability files; ~20 MB installer, ~60 MB RAM. Revisit only if we ever need Node.js runtime features inside the shell.

---

## D-002 — Core language: Rust with Tokio

- **Status:** Accepted
- **Date:** Project kickoff

**Context:** the core must supervise child processes, stream file I/O, own SQLite transactions, and detect hardware — without a heavy runtime.

**Decision:** Rust with the Tokio async runtime.

**Alternatives rejected:** Go and Python — both lack the combination of native OS supervision, zero-runtime binaries, and safe concurrency we need.

**Consequences:** all durable state and orchestration live in Rust ("Rust owns durable truth"); CPU-heavy work goes through `tokio::task::spawn_blocking` so the IPC loop never stalls. Revisit per-feature as ergonomic friction appears.

---

## D-003 — Frontend: React 19 + Vite + TailwindCSS

- **Status:** Accepted
- **Date:** Project kickoff

**Context:** we need fast UI iteration, a component ecosystem, and a small learning surface for a two-person team.

**Decision:** React 19 with TypeScript, Vite, and TailwindCSS.

**Alternatives rejected:** SvelteKit and Vue — viable but weaker team familiarity and ecosystem momentum for canvas-heavy interactive work.

**Consequences:** charting via Chart.js/Recharts; interactive comic layouts via HTML5 Canvas/Fabric.js. Vite gives instant HMR inside the Tauri webview.

---

## D-004 — Persistence: SQLite WAL with a Single Writer Actor

- **Status:** Accepted
- **Date:** Project kickoff

**Context:** pipeline state (messages, sessions, events, jobs) must survive crashes; concurrent async writes to one file cause `SQLITE_BUSY` lock contention.

**Decision:** SQLite in WAL mode, with a single Database Writer Actor consuming a Tokio MPSC channel; independent read connections for the UI.

**Alternatives rejected:** PostgreSQL (server process, not portable), IndexedDB (inside the webview, not durable truth).

**Consequences:** all writes funnel through one actor with tiered commit policies (architecture §5.4); reads never block on writes. Revisit only if we outgrow a single-file database.

---

## D-005 — LLM inference: `llama-server` sidecar

- **Status:** Accepted
- **Date:** Project kickoff

**Context:** local, privacy-first inference with model flexibility and GPU control.

**Decision:** manage `llama-server` (llama.cpp) as a Tauri sidecar over localhost HTTP; model-agnostic GGUF files selected via `ModelManifest`.

**Alternatives rejected:** Ollama (less control over KV slots/offload), Python `transformers` (heavy runtime, slower).

**Consequences:** the Rust Supervisor owns process lifecycle (job objects / process groups) so no orphaned processes; dispatcher concurrency must match `--parallel N` (architecture §5.5).

---

## D-006 — Image generation (v1): cloud API with anonymization

- **Status:** Accepted
- **Date:** Project kickoff

**Context:** v1 must work for every user, including 16 GB RAM / no-GPU machines where local diffusion risks OOM.

**Decision:** v1 image generation via cloud APIs (fal.ai / Replicate Flux) with an automated pre-flight privacy audit; local diffusion is an opt-in v2 feature with a VRAM handover state machine.

**Alternatives rejected:** local-only diffusion — requires ≥ 8 GB VRAM and ≥ 24 GB RAM, excluding most users.

**Consequences:** a privacy boundary is non-negotiable: prompts are scrubbed of real names/quotes before dispatch, and a cost governor enforces the per-run ceiling (default $3.00). See [Ashwani's Track](ashwani/milestones.md#feature-a5--cloud-image-gateway-prompt-engine--privacy-anonymizer).

---

## D-007 — Contracts: manually authored types

- **Status:** Accepted
- **Date:** Project kickoff

**Context:** the Rust core and React frontend share every data shape across IPC. A two-person team needs a lightweight way to keep them in sync.

**Decision:** hand-author the shared types on both sides, with [contracts.md](contracts.md) as the written agreement. No code generation.

**Alternatives rejected:** protobuf / OpenAPI codegen — tooling overhead exceeds manual-sync overhead at this team size.

**Consequences:** a contract change updates the doc + both codebases in one change (the rule in [contracts.md](contracts.md#the-rule)); mock fixtures unblock parallel work.

---

## D-008 — Session segmentation: 30-minute gap + signal gate

- **Status:** Accepted · benchmark-validated
- **Date:** 2026-08 (after the 126 K-message benchmark)

**Context:** the benchmark showed segmentation thresholds wildly change session counts (5-min gaps → 3,659 micro-sessions; participant-shift → 6,757). Not every session deserves LLM processing.

**Decision:** default to a 30-minute inactivity gap (~1,026 sessions on the benchmark chat) and pass sessions to the LLM only when `count ≥ 5 AND score ≥ P25` (richness formula in architecture §5.2). ~42 % of sessions are fast-tracked with 1-line summaries instead of full extraction.

**Alternatives rejected:** adaptive time-of-day gaps (complexity without measured benefit), participant-shift segmentation (over-segments rapid multi-way banter).

**Consequences:** ~58 % of sessions reach the LLM; the P25 threshold is relative to each dataset, so the ratio may shift on sparser chats.
