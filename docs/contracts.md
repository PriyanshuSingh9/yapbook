# Yapbook — Shared Contracts (TS ↔ Rust)

> The typed seam between the Rust core and the React frontend. This document is the **agreement** — both tracks implement against it and keep it in sync.
> See [Decision D-007](decisions.md#d-007--contracts-manually-authored-types) for why we hand-author types instead of generating them.

## The Rule

**A contract is a promise between the two tracks.** Any change to a contract must land in all three places in the same change:

1. This document (the agreement)
2. The Rust type under `src-tauri/src/contracts/`
3. The TypeScript type under `src/types/contracts/`

No silent one-sided changes. If a contract breaks, the failing side is the one that didn't follow the rule.

## Where the types live

| Side              | Location (established in Feature P1 / A1)                                                     |
| :---------------- | :-------------------------------------------------------------------------------------------- |
| **Rust**          | `src-tauri/src/contracts/` — `pub struct` / `enum` with `serde::{Serialize, Deserialize}`     |
| **TypeScript**    | `src/types/contracts/` — interfaces mirroring the Rust structs                                |
| **Mock fixtures** | `src/mocks/` in the frontend, plus the benchmark artifact `benchmarks/chat-stats/report.json` |

Both files are hand-maintained and must stay in sync. There is no code generation (D-007).

## The Contracts

Each entry lists what the contract carries, who produces/consumes it, which features depend on it, and a draft shape. Drafts are starting points — they evolve as features land, which is exactly why the changelog at the bottom exists.

---

### `ipc.ts` — Core IPC commands & events

- **Carries:** typed command results and streaming pipeline events between the webview and Rust.
- **Producer:** Priyanshu (P1) · **Consumer:** Ashwani (A1)
- **Draft:**
  ```ts
  type AppResult<T> = { ok: true; data: T } | { ok: false; error: AppError };
  type AppError =
    | { kind: "io"; message: string }
    | { kind: "database"; message: string }
    | { kind: "parser"; message: string }
    | { kind: "inference"; message: string }
    | { kind: "security"; message: string };
  ```
- **Mock:** none required — `invoke('ping') → 'pong'` is the A1 smoke test, already wrapped by the mock API layer.

---

### `analytics.ts` — AnalyticsReport

- **Carries:** the full statistical report: volume, temporal, per-member, social, content, milestones, token/shape, language.
- **Producer:** Priyanshu (P3) · **Consumer:** Ashwani (A2)
- **Draft:** mirrors the committed `benchmarks/chat-stats/report.json` structure:
  `volumeMetrics`, `temporalMetrics`, `memberMetrics` (keyed by sender), `socialMetrics`, `contentMetrics`, `milestones`, `tokenAndShapeMetrics`, `languageMetrics`.
- **Mock:** `benchmarks/chat-stats/report.json` is the canonical fixture for A2.

---

### `sessions.ts` — Sessions

- **Carries:** session boundaries, richness score, signal flag, participants.
- **Producer:** Priyanshu (P5) · **Consumer:** Ashwani (A3)
- **Draft:**
  ```ts
  interface Session {
    id: number;
    projectId: string;
    startTime: number; // UTC epoch seconds
    endTime: number;
    messageCount: number;
    participants: string[];
    richnessScore: number; // signal-gate formula — architecture §5.2
    isHighSignal: boolean;
  }
  ```
- **Mock:** session fixtures in `src/mocks/` until P5 lands.

---

### `events.ts` — Extracted Events

- **Carries:** validated narrative events with source-message provenance.
- **Producer:** Priyanshu (P7) · **Consumer:** Ashwani (A3)
- **Draft:**
  ```ts
  interface Event {
    id: string;
    sessionId: number;
    title: string;
    summary: string;
    eventType: string;
    participants: string[]; // validated against the member whitelist
    sourceMessageIds: number[]; // Rust-validated: every ID exists in the session
    timestamp: number;
  }
  ```
- **Rule:** `sourceMessageIds` is only populated after Rust's semantic validator confirms each ID (architecture §5.3 — "the model proposes evidence; the application establishes evidence").

---

### `memory.ts` — Memory State

- **Carries:** member profiles, running jokes, group culture notes, relationship dynamics.
- **Producer:** Priyanshu (P8) · **Consumer:** Ashwani (A4)
- **Draft:**
  ```ts
  interface MemberProfile {
    memberId: string;
    personalityTraits: string[];
    communicationStyle: string;
    interests: string[];
    evolutionNotes: string[]; // how behavior changed over time
    provenanceEventIds: string[];
  }
  interface RunningJoke {
    text: string;
    originEventId: string;
    memberCount: number;
  }
  interface CultureNote {
    note: string;
    provenanceEventIds: string[];
  }
  ```
- **Mock:** profile fixtures in `src/mocks/` (A4 runs on mocks until P8 lands).

---

### `storyboard.ts` — Storyboard Specs

- **Carries:** a 3–6 panel comic script: title, panels, scene, characters, dialogue, composition.
- **Producer:** Priyanshu (P9) · **Consumer:** Ashwani (A5, A6)
- **Draft:**
  ```ts
  interface Storyboard {
    id: string;
    runId: string;
    title: string;
    panels: Panel[];
  }
  interface Panel {
    number: number;
    sceneDescription: string;
    charactersPresent: string[];
    dialogue: string[]; // adapted comic speech, not raw chat
    visualComposition: string;
    mood: string;
  }
  ```

---

### `artifacts.ts` — Artifacts & Runs

- **Carries:** content-addressed hashes, run manifests, image object references.
- **Producer:** Priyanshu (P10) · **Consumer:** Ashwani (A6)
- **Draft:**
  ```ts
  interface ArtifactRef {
    sha256: string;
    kind: "image" | "json";
  }
  interface RunManifest {
    runId: string;
    config: Record<string, unknown>;
    modelHashes: Record<string, string>;
    promptVersions: Record<string, string>;
    panelHashMapping: Record<string, string>;
  }
  ```

---

### `models.ts` — Model & Hardware

- **Carries:** ModelManifest entries, hardware capability report, download progress.
- **Producer:** Priyanshu (P6, P12) · **Consumer:** Ashwani (A7)
- **Draft:**
  ```ts
  interface HardwareCapability {
    gpu: string | null;
    vramGb: number;
    ramGb: number;
    backend: "cuda" | "metal" | "vulkan" | "cpu";
  }
  interface DownloadProgress {
    downloadedBytes: number;
    totalBytes: number;
    speedMbps: number;
    status: "downloading" | "paused" | "verifying" | "done" | "error";
  }
  ```

---

### `jobs.ts` — Jobs & Pipeline State

- **Carries:** job lifecycle state for the pipeline.
- **Producer:** Priyanshu (P1, P4) · **Consumer:** Ashwani (A1, A7)
- **Draft:**
  ```ts
  interface Job {
    id: string;
    runId: string;
    jobType: string;
    status: "queued" | "running" | "completed" | "orphaned" | "failed";
    updatedAt: number;
  }
  ```

---

## Changing a contract

1. **Propose** the change — a quick sync between the two devs, or a PR description.
2. **Agree on the shape.** Prefer backwards-compatible changes (add optional fields) over breaking existing ones.
3. **Land it in one change:** this doc + the Rust type + the TS type.
4. **Update mock fixtures** the frontend consumes.
5. **Append to the changelog** below.
