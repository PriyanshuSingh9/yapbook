# Priyanshu's Track — Core Engine, Rust & Pipeline

> This is Priyanshu's development roadmap for Yapbook. It focuses on building the native Rust engine, SQLite persistence, LLM supervision, data pipeline state machines, artifact storage, and the high-res native compositor.
>
> For full problem descriptions, requirements, and architectural context, see the [Master Roadmap](../milestones.md) and [Architecture](../architecture.md). For the Image Generation Pipeline & Visual Experience, see [Ashwani's Track](../ashwani/milestones.md).

---

## Progress Tracker

```
[ ] Feature P1  — Tauri v2 Core Setup, IPC Bridge & Security          (Sprint 1)
[ ] Feature P2  — Streaming Iterator WhatsApp Parser                   (Sprint 1)
[ ] Feature P3  — Statistical Analytics & Social Metric Engine         (Sprint 1)
[ ] Feature P4  — SQLite WAL Persistence & Tiered Database Actor       (Sprint 2)
[ ] Feature P5  — Session Segmenter & Robust Signal Gate               (Sprint 2)
[ ] Feature P6  — llama-server Supervisor & Model Manifest Registry    (Sprint 2)
[ ] Feature P7  — Parallel Event Extraction & Provenance Validation    (Sprint 3)
[ ] Feature P8  — Chronological Memory Synthesis                       (Sprint 3)
[ ] Feature P9  — Storyboard Script Planner & Narrative Generator      (Sprint 3)
[ ] Feature P10 — Content-Addressed Artifact Store & Image Backend     (Sprint 4)
[ ] Feature P11 — Native Rust Compositor & High-Res Export             (Sprint 4)
[ ] Feature P12 — Resumable Model Downloader & Multi-Platform CI/CD    (Sprint 5)
```

---

## Working Philosophy

### Your Domain

Rust (Tokio, Rusqlite, Reqwest, Serde, Image crate), Tauri v2 Core, C++ `llama.cpp` sidecars, SQLite in WAL mode, content-addressed artifact storage.

### Core Invariant

> **"Rust owns durable truth and orchestration. Workers perform computation. React owns presentation and interaction."**

You own state machines, durability, process lifecycles, provenance verification, and data integrity. Ashwani owns visual prompt design, image generation provider clients, and the comic editor. You provide Ashwani with immutable content-addressed storage for images, storyboard persistence, and the native 300 DPI compositor.

### Shared Type Contracts

Implement against strongly-typed interfaces defined collaboratively with Ashwani in [contracts.md](../contracts.md):
- Analytics report and heatmap matrices
- Session boundaries and signal flags
- Extracted events and memory state
- Storyboard specifications and dialogue models
- Image artifact hashes and run manifests
- Model download progress and supervisor status

### The "Zero-Block" Rule

Test 100 % of Rust code with `cargo test` and CLI integration harnesses. You do not need Ashwani's React UI to develop or verify any backend feature.

---

## Feature P1 — Tauri v2 Core Setup, IPC Bridge & Security

> Master roadmap reference: [Feature 1 — Foundation & Tauri v2 Shell](../milestones.md#feature-1--foundation--tauri-v2-shell)

### What You're Building

The Rust application core: Tauri v2 project structure, async Tokio runtime, IPC command routing, and security permissions. Every subsequent feature depends on this.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Concurrency runtime | Tokio multi-threaded | Native OS threads | Tokio gives you lightweight tasks, async channels, and non-blocking I/O in one package |
| CPU-heavy offloading | `tokio::task::spawn_blocking` | Run on async threads (will block the IPC loop) | Any task with > 1 ms of blocking CPU work should use `spawn_blocking` |
| Error type | Typed `AppError` enum with `serde::Serialize` | Raw string errors | Typed errors give the frontend structured information to display |

### What to Build

- Tauri v2 project scaffolding (`src-tauri/`, `Cargo.toml`, `tauri.conf.json`)
- Tokio multi-threaded runtime in `main.rs`
- Global `AppError` enum:
  ```rust
  #[derive(Debug, thiserror::Error, Serialize)]
  pub enum AppError {
      #[error("I/O error: {0}")]         Io(String),
      #[error("Database error: {0}")]     Database(String),
      #[error("Parser error: {0}")]       Parser(String),
      #[error("Inference error: {0}")]    Inference(String),
      #[error("Unauthorized: {0}")]       Security(String),
  }
  ```
- Command module structure (`commands/import.rs`, `commands/analytics.rs`, `commands/pipeline.rs`)
- Tauri capability permissions: shell subprocess spawning, app-data directory read/write
- `spawn_blocking` helper for CPU-heavy tasks

### How to Verify

- `cargo check` passes cleanly
- `invoke("ping")` from the frontend returns a typed `Result<String, AppError>`
- `cargo test` runs with at least one passing test

---

## Feature P2 — Streaming Iterator WhatsApp Parser

> Master roadmap reference: [Feature 2 — Streaming WhatsApp Parser](../milestones.md#feature-2--streaming-whatsapp-parser)

### What You're Building

A high-throughput streaming parser that yields messages one-by-one from a WhatsApp export without buffering everything in memory. This is the entry point for all chat data.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Iterator vs collect | `Iterator<Item = Result<Message, ParseError>>` | `Vec<Message>` in memory | Iterator keeps memory < 10 MB; Vec would consume hundreds of MB on large exports |
| Date format detection | Heuristic regex (auto-detect 12/24h, EU/US) | User-selected format dropdown | WhatsApp exports vary by locale — heuristic avoids forcing the user to choose |
| Token estimation | `char_count / 4.0` (rough heuristic) | Actual tokenizer (accurate but adds a dependency) | Heuristic is fine for priority sorting; empirical measurements are used for time estimates |

### Core Data Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: i64,
    pub group_id: String,
    pub timestamp: i64,         // UTC Epoch seconds
    pub sender: String,
    pub content: String,
    pub msg_type: MessageType,  // Text, System, Deleted, Link, MediaOmitted
    pub char_count: u32,
    pub word_count: u32,
    pub shape: MessageShape,    // EmojiOnly, SingleWord, Short, Medium, Long, Placeholder
}
```

### Edge Cases to Handle

| Edge Case | Behavior |
| :--- | :--- |
| Invalid UTF-8 in export | `from_utf8_lossy`, log warning count |
| Malformed timestamp line | Treat as multiline continuation of preceding message |
| Corrupt `.zip` archive | Return `AppError::Parser("Corrupted zip format")` |
| Narrow no-break space (`\u202F`) in AM/PM | Regex must match this as whitespace |
| `@mention` Unicode isolate tags (`\u2066-\u2069`) | Strip from content |

### How to Verify

- Ingests `WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt` (137 k lines → ~126 k messages) with 0 parse errors
- Completes in < 2 s in release mode
- Peak memory < 10 MB (check via `/proc/self/status` or a profiler)

---

## Feature P3 — Statistical Analytics & Social Metric Engine

> Master roadmap reference: [Feature 3 — Statistical Analytics Engine](../milestones.md#feature-3--statistical-analytics-engine)

### What You're Building

Deterministic analytics engine computing statistical metric categories in a single O(N) pass. No LLM involved — pure stats.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Pass count | Single-pass accumulators (all metrics in one iteration) | Multi-pass (simpler per-metric logic) | Single-pass is 15× faster; complexity is manageable with good module separation |
| Reply detection | Previous sender within 3-min window | Explicit WhatsApp reply metadata (not available in exports) | Time-window heuristic is the only option given export format limitations |

### Metric Categories

1. Volume (daily, weekly, monthly curves)
2. Temporal (7×24 hourly heatmap, busiest day, longest silence gap)
3. Member participation (per-member word count, emoji count, active days)
4. Social interaction (N×N directional reply matrix, ghosting ratios)
5. Milestones (first message, 10 k / 50 k timestamps, group creation)

### Edge Cases to Handle

| Edge Case | Behavior |
| :--- | :--- |
| Zero non-system messages | Return empty dataset with zeroed averages (no divide-by-zero) |
| Single-member chat | Return empty reply graph; flag as direct conversation |
| Messages spanning multiple years | Ensure temporal heatmap and volume curves handle year boundaries |

### How to Verify

- Results exactly match the pre-computed `benchmarks/chat-stats/report.json`
- Execution completes in < 500 ms in release mode for 126 K messages

---

## Feature P4 — SQLite WAL Persistence & Tiered Database Actor

> Master roadmap reference: [Feature 5 — SQLite WAL Persistence & Database Actor](../milestones.md#feature-5--sqlite-wal-persistence--database-actor)

### What You're Building

The durability layer. All pipeline state goes through a single writer actor over Tokio channels, with independent read connections for UI queries.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Write concurrency | Single Writer Actor (`mpsc` channel) | Connection pool with mutex | Actor eliminates `SQLITE_BUSY` entirely — no lock contention |
| Commit granularity | Tiered per data type (see [architecture](../architecture.md#54-tiered-database-commit-policy)) | One-size-fits-all `FULL` sync | Tiered gives 5× ingestion throughput while preserving durability for critical state |
| Migration system | `schema_version` table + ordered SQL scripts | ORM migration tool | Keep it simple — manual SQL scripts with version tracking |

### Core Schema (Initial)

```sql
CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    timestamp INTEGER NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    msg_type TEXT NOT NULL
);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    message_count INTEGER NOT NULL,
    is_high_signal INTEGER NOT NULL,
    richness_score REAL NOT NULL
);

CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,  -- 'queued', 'running', 'completed', 'orphaned', 'failed'
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
```

See [architecture.md](../architecture.md#7-data-migration--schema-evolution) for the migration strategy as new tables are added.

### How to Verify

- 10+ concurrent Tokio tasks writing 1,000 records each: 0 lock errors, 100 % committed
- Kill the process mid-write, restart: orphaned jobs detected via `status='running'` and recovered
- Read queries during active writes return results without blocking

---

## Feature P5 — Session Segmenter & Robust Signal Gate

> Master roadmap reference: [Feature 6 — Session Segmenter & Signal Gate](../milestones.md#feature-6--session-segmenter--signal-gate)

### What You're Building

The algorithm that divides the message stream into conversational episodes and scores each one to decide if it's worth the cost of LLM processing.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Inactivity gap | Fixed 30 min | Adaptive (vary by time-of-day) | Start with fixed; adaptive adds complexity with unclear benefit — measure later |
| Monologue handling | Bonus multiplier (1.5×) for single-speaker storytelling | Penalize single-speaker sessions | Monologues are often the most narrative-rich content — don't filter them out |
| Threshold | Count ≥ 5 AND Score ≥ P25 | Fixed score cutoff | P25 is relative to the dataset; fixed cutoffs fail on different-sized groups |

### Signal Gate Formula

**Score** = (MessageCount × AvgWords × (1.0 + ln(Participants)) × MonologueBonus) / max(DurationMins, 1.0)

The `max(DurationMins, 1.0)` smoothing prevents divide-by-zero on sub-minute bursts.

### How to Verify

- 126 K messages → ~1,026 sessions
- ~42 % flagged as low-signal / fast-track
- No divide-by-zero errors on any session
- Monologue sessions (single speaker, long messages) are scored ≥ P25

---

## Feature P6 — llama-server Supervisor & Model Manifest Registry

> Master roadmap reference: [Feature 7 — llama-server Sidecar Supervisor](../milestones.md#feature-7--llama-server-sidecar-supervisor)

### What You're Building

The process manager for the LLM inference sidecar. It needs to detect hardware, pick the right model configuration, spawn `llama-server`, verify health, and guarantee no orphaned processes.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Model definition | `ModelManifest` registry (config-driven) | Hardcoded model name | Manifest makes switching models a config change — essential for testing multiple models |
| Process binding | OS Job Objects (Windows) / Process Groups (Unix) | `tokio::process::Child` drop handler | OS-level binding survives parent crashes; drop handler doesn't |
| Health checking | Poll `GET /health` with 60 s timeout | Assume ready after N seconds | Polling is deterministic; fixed delay is fragile on slow hardware |
| Concurrency slots | `--parallel N` from manifest, matching dispatcher concurrency | Hardcoded | Must match dispatcher — see [architecture](../architecture.md#55-llm-concurrency-model) |

### How to Verify

- `llama-server` spawns and passes health check
- Kill Yapbook: `llama-server` also dies (verify with `ps` / Task Manager)
- Stale PID from a previous crash is cleaned up on restart
- `get_supervisor_status()` IPC command returns correct state

---

## Feature P7 — Parallel Event Extraction & Provenance Validation

> Master roadmap reference: [Feature 8 — Event Extraction & Provenance Validation](../milestones.md#feature-8--event-extraction--provenance-validation)

### What You're Building

The prompt execution engine that sends high-signal sessions to `llama-server`, parses structured event responses, and independently verifies every provenance claim before committing.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Output format | JSON Schema grammar constraint on `llama-server` | Free-text + regex parsing | Grammar constraint eliminates most parse errors at the source |
| Provenance | Application-verified (every ID checked in SQLite) | Trust LLM citations | LLMs hallucinate citations — verification is non-negotiable |
| Failure policy | Retry → low-temp retry → 1-line deterministic fallback | Drop invalid sessions | Never drop data; always produce at least a minimal summary |

### Fallback Chain

1. Normal extraction (temperature 0.7)
2. If validation fails → Retry with temperature 0.1
3. If still fails → Generate deterministic 1-line summary from session metadata (no LLM needed)

### How to Verify

- Build a golden eval fixture of 20 representative sessions
- ≥ 90 % direct valid extraction on first attempt
- 100 % coverage — remaining edge cases trigger fallback cleanly
- 0 committed events with invalid `source_message_ids`

---

## Feature P8 — Chronological Memory Synthesis

> Master roadmap reference: [Feature 9 — Memory Synthesis](../milestones.md#feature-9--memory-synthesis)

### What You're Building

The stage that processes extracted events in chronological order to build evolving member profiles, running jokes, and group culture notes.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Processing order | Strict chronological (events sorted by source timestamp) | Batch by member | Chronological preserves the narrative arc and relationship evolution |
| Update strategy | Incremental reducer (LLM produces diffs to existing state) | Full rewrite each batch | Incremental is cheaper and avoids losing information from previous passes |
| Batch size | ~25 events per synthesis call | Single-event updates | 25 balances context richness against token cost |

### How to Verify

- Completed run produces non-trivial member profiles and running jokes
- Every memory claim traces back to source events → source messages
- Incremental updates preserve information from earlier batches

---

## Feature P9 — Storyboard Script Planner & Narrative Generator

> Master roadmap reference: [Feature 10 — Storyboard Script Generator](../milestones.md#feature-10--storyboard-script-generator)

### What You're Building

The narrative planner that selects the most memorable events and converts them into structured 3–6 panel comic scripts with scene descriptions, characters present, visual composition notes, and adapted dialogue.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Moment selection | Scoring algorithm (multi-member presence, emotion, humor) | Manual user selection | Start with scoring; add user curation later as a feature |
| Dialogue adaptation | LLM rewrites chat into punchy comic speech | Use raw chat text verbatim | Raw chat is too long/messy for speech bubbles — adaptation is necessary |
| Panel count | 3–6 per storyboard | Fixed 4 panels | Variable allows the story to breathe; some moments are 3 panels, some are 6 |

### How to Verify

- Generated storyboards are valid JSON matching the schema
- Dialogue reads naturally as comic speech — not raw chat dumps
- Panel count falls within 3–6 range
- Storyboards saved to SQLite and content-addressed artifact store

---

## Feature P10 — Content-Addressed Artifact Store & Image Backend

> Master roadmap reference: [Feature 11](../milestones.md#feature-11--character-bootstrapping--image-pipeline), [Architecture § 5.7](../architecture.md#57-content-addressed-artifact-store)

### What You're Building

The backend storage and persistence system for all generated image assets (character turnaround sheets, rendered comic panels, and run manifests). Handles immutable SHA-256 indexing, local filesystem persistence, and the optional VRAM Handover supervisor for local diffusion.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Object Storage | Content-addressed `artifacts/objects/{sha256}.png` | Filename-based paths | Content-addressing deduplicates identical renders and makes runs 100% reproducible |
| Run Manifests | `artifacts/runs/run-xxx/manifest.json` | Solely in SQLite | File-based manifests allow standalone comic bundle export and backup |
| Local VRAM Handover | State machine (kill LLM → verify free VRAM → launch diffusion sidecar) | Run LLM & diffusion concurrently | Single GPU systems cannot fit both an 8B LLM and SDXL in VRAM simultaneously |

### What to Build

- **Content-Addressed Store (`src-tauri/src/artifacts/`)**:
  Computes SHA-256 on generated PNG bytes and writes to `artifacts/objects/ab/ab82f...png`.
- **Run Manifest Writer**:
  Saves complete run configurations, prompt versions, model manifests, and panel hash mappings to `artifacts/runs/run-xxx/manifest.json`.
- **SQLite Image Linkage**:
  Associates storyboard panel records with their content-addressed image object hashes.
- **Optional Local Diffusion Sidecar Supervisor**:
  VRAM Handover state machine for local GPU setups: terminate `llama-server` → poll free VRAM > 6.0 GB → launch headless ComfyUI/Diffusers worker.

### How to Verify

- Writing 100 sample images through the artifact manager results in correct SHA-256 indexed directory trees
- Identical images are automatically deduplicated
- Run manifests can be read back and fully re-hydrate a comic project

---

## Feature P11 — Native Rust Compositor & High-Res Export

> Master roadmap reference: [Feature 13 — Compositor & High-Res Export](../milestones.md#feature-13--compositor--high-res-export)

### What You're Building

The Rust-native image compositor that takes panel images from the artifact store + storyboard layout from SQLite and produces print-ready 300 DPI PNG strips and multi-page PDFs.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Text rendering | `ab_glyph` / `imageproc` | Full external typesetting engine | `ab_glyph` is lightweight, fast, and sufficient for crisp speech bubble typography |
| Output formats | PNG strip + multi-page PDF | PNG only | PDF is expected for "comic book" output |

### What to Build

- Panel image loader and grid layout math in Rust
- Vector speech bubble and comic font rasterization via `ab_glyph` / `imageproc`
- High-resolution 300 DPI PNG strip exporter
- Multi-page PDF generation with page numbers, margins, and project title headers
- `export_comic` Tauri command with native OS "Save File" dialog

### How to Verify

- Exported PNG is 300 DPI and matches Ashwani's studio canvas layout
- PDF has correct page breaks, page numbers, and project title
- Export completes in < 10 s for a 30-panel comic

---

## Feature P12 — Resumable Model Downloader & Multi-Platform CI/CD

> Master roadmap reference: [Feature 14](../milestones.md#feature-14--model-download-manager--onboarding), [Feature 15](../milestones.md#feature-15--hardening--multi-platform-cicd)

### What You're Building

The model download system with pause/resume support and the CI/CD pipeline that produces release installers for Windows, macOS, and Linux.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Download strategy | Chunked streaming with byte-range resume (`reqwest`) | Single GET (no resume) | 4.5 GB file on unstable connections — resume is essential |
| CI platform | GitHub Actions matrix | Manual builds | Automation is non-negotiable for 3 target platforms |

### Build Matrix

| Platform | Bundled Binary | Output |
| :--- | :--- | :--- |
| Windows | `llama-server.exe` | `.msi` / `.exe` installer |
| macOS (Apple Silicon) | `llama-server` (Metal) | `.dmg` |
| Linux | `llama-server` (CUDA/Vulkan) | `.deb` / `AppImage` |

### How to Verify

- Download can be paused and resumed without corruption
- SHA-256 checksum matches after complete download
- CI builds succeed on all three platforms
- Installed application launches and completes basic import + analytics flow
