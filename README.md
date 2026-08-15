# Yapbook

> **Status: Pre-implementation — Architecture & Planning Phase**

Turn group chat histories into comic-book memories.

Yapbook is a native desktop application that takes a WhatsApp group chat export and transforms it into illustrated comic book stories — capturing the moments, dynamics, personalities, and inside jokes that make your friend group unique.

---

## How It Works

1. **Import** your WhatsApp group chat export (`.zip` / `.txt`).
2. **Deterministic Preprocessing** — Cleans and normalizes messages, builds social interaction heatmaps, and segments conversations into coherent episodes.
3. **LLM Memory & Event Extraction** — Extracts memorable narrative events, builds evolving member profiles, and tracks running jokes — all with complete source message provenance.
4. **Storyboard & Comic Studio** — Converts events into panel-by-panel comic scripts, generates consistent character illustrations, and composites speech bubbles and layouts into an illustrated comic book.

---

## Technology Stack

| Layer                | Technology                                     | Notes                                                                                 |
| :------------------- | :--------------------------------------------- | :------------------------------------------------------------------------------------ |
| **Desktop Shell**    | [Tauri v2](https://v2.tauri.app/)              | ~20 MB installer, ~60 MB RAM footprint, capability-based IPC security                 |
| **Frontend**         | React 19, TypeScript, Vite, TailwindCSS        | HTML5 Web Canvas / Fabric.js for interactive comic layouts                            |
| **Core Engine**      | Rust (`tokio`, `rusqlite`, `reqwest`, `serde`) | Supervisor, pipeline orchestration, state machine, native compositor                  |
| **Persistence**      | SQLite in WAL mode                             | Single Database Writer Actor pattern, resumable crash-safe state                      |
| **Local LLM**        | `llama-server` (`llama.cpp`) sidecar           | Quantized GGUF models — v1 default: Qwen 2.5 7B Q4_K_M, swappable via `ModelManifest` |
| **Image Generation** | Cloud API (fal.ai / Replicate Flux)            | Privacy-first anonymization; character turnaround consistency; style presets          |
| **Compositing**      | Web Canvas + Rust `image` crate                | Interactive preview in browser; print-ready 300 DPI PDF/PNG export in Rust            |

---

## Privacy & Safety

- **Local-First** — Chat processing, analytics, and memory extraction run 100 % locally.
- **Privacy Boundary** — Cloud image prompts are scrubbed of real names, quotes, and identifiers before dispatch (`Character A (young man, hoodie, glasses)`).
- **Zero Telemetry on Messages** — Raw chat data, prompts, and extracted memories never leave your computer.s
