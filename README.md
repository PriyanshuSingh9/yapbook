# Yapbook

> Turn group chat histories into comic-book memories.

Yapbook is a privacy-first native desktop application that takes a WhatsApp group chat export and transforms it into illustrated comic book stories -- capturing the moments, dynamics, personalities, and running jokes that make your friend group unique.

---

## Core Invariant

> **Rust owns durable truth and orchestration. Workers perform computation. React owns presentation and interaction.**

---

## How It Works

1. **Import** -- Ingest WhatsApp group chat export (`.zip` / `.txt`).
2. **Streaming Preprocessing** -- Cleans and normalizes messages, builds social interaction heatmaps, and segments conversations into discrete episodes using a 30-minute inactivity boundary.
3. **LLM Memory & Event Extraction** -- Extracts narrative events, synthesizes evolving member profiles, and tracks running jokes with application-verified source message provenance.
4. **Comic Studio & Generation** -- Converts events into multi-panel comic scripts, generates consistent character illustrations via reference turnaround sheets, and allows interactive speech bubble layout editing.
5. **Deterministic Export** -- Renders print-ready 300 DPI multi-page PDF comic books and shareable PNG strips using the native Rust image pipeline.

---

## Technology Stack

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| **Desktop Shell** | [Tauri v2](https://v2.tauri.app/) | ~20 MB installer, ~60 MB RAM footprint, capability-based IPC security |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS | HTML5 Web Canvas / Fabric.js for interactive comic layouts |
| **Core Engine** | Rust (`tokio`, `rusqlite`, `reqwest`, `serde`) | Process supervisor, pipeline orchestration, state machine, native compositor |
| **Persistence** | SQLite in WAL mode | Single Database Writer Actor pattern, tiered commit policies, crash-safe state |
| **Inference Sidecar** | `llama-server` (`llama.cpp`) | Quantized GGUF models (swappable via `ModelManifest` registry) |
| **Image Generation** | Cloud API (fal.ai / Replicate Flux) + Local Worker | Anonymized prompts, character turnaround reference consistency |
| **Compositing** | Web Canvas + Rust `image` crate | Interactive preview in browser, print-ready 300 DPI PDF/PNG export in Rust |

---

## Project Structure

```
yapbook/
|-- docs/
|   |-- architecture.md          # Master system architecture & technical invariants
|   |-- milestones.md            # Master roadmap (15 features across 5 sprints)
|   |-- ashwani/
|   |   `-- milestones.md        # Frontend & Comic Studio roadmap (Ashwani)
|   |-- priyanshu/
|   |   `-- milestones.md        # Core Engine & Systems roadmap (Priyanshu)
|   `-- processing-times.md      # Empirical benchmark processing analysis
|-- benchmarks/
|   `-- chat-stats/              # 126k message benchmark suite & sample dataset
|-- src/                         # React 19 + TypeScript frontend application
|   |-- components/              # UI widgets (Charts, Canvas Studio, Dropzone)
|   |-- pages/                   # View screens (Import, Analytics, Inspector, Studio)
|   `-- services/                # Tauri IPC bridge & mock data providers
|-- src-tauri/                   # Rust core engine & Tauri v2 backend
|   |-- src/
|   |   |-- commands/            # Tauri IPC command handlers
|   |   |-- parser/              # Streaming WhatsApp regex parser iterator
|   |   |-- analytics/           # Single-pass statistical metric accumulator
|   |   |-- db/                  # SQLite WAL connection & Database Writer Actor
|   |   |-- supervisor/          # llama-server sidecar process supervisor
|   |   `-- main.rs              # Application entry point
|   |-- Cargo.toml               # Rust dependencies
|   `-- tauri.conf.json          # Tauri capability & window configuration
|-- public/                      # Static assets & icons
|-- package.json                 # Node dependencies and scripts
|-- tsconfig.json                # TypeScript configuration
`-- vite.config.ts               # Vite bundler configuration
```

---

## Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v9 or higher (`npm install -g pnpm`)
- **Rust**: stable toolchain (`rustup default stable`)
- **Platform Dependencies**:
  - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft C++ Build Tools & WebView2

### Installation

```bash
# Install frontend dependencies (pnpm only)
pnpm install
```

### Development

```bash
# Run frontend only with Vite (browser dev mode with mock data)
pnpm dev

# Run desktop application (Tauri + React + Rust backend)
pnpm tauri dev
```

### Testing

```bash
# Run Rust unit & integration tests
cargo test --manifest-path src-tauri/Cargo.toml

# Run TypeScript type check
pnpm build
```

---

## Privacy & Security

- **Local-First Processing** -- Chat parsing, analytics calculation, sessionization, and local LLM extraction run entirely offline on the user device.
- **Strict Privacy Boundary** -- When cloud image generation is enabled, all prompts are anonymized locally before dispatch (`Character A (young man, hoodie, glasses)`). Zero real names, message quotes, or personal identifiers ever leave the computer.
- **Zero Telemetry on Messages** -- Raw chat files, prompts, and extracted memories are stored exclusively in local SQLite and content-addressed filesystem storage.
