# Yapbook — Setup & Getting Started

> A teaching guide: the *why* behind each step, so you understand what you're doing rather than just running commands. We're setting up only the workspace and the minimal dependencies Feature 1 needs — nothing more. The rest lands feature-by-feature per the [master roadmap](milestones.md).

---

## The big idea: you already have a "workspace"

Before any command, understand the shape of what you're building.

A Tauri app is **two sides in one repository**:

- `src-tauri/` — the **Rust core**. This is the durable-truth side (Priyanshu's domain): it owns state, files, processes, and orchestration.
- `src/` — the **web frontend**. This is the presentation side (Ashwani's domain): React, styling, interactions.

These two sides share **nothing at runtime except typed IPC** through the Tauri bridge. They don't share code, they don't share state, they don't even share a language. The seam between them is defined in [contracts.md](contracts.md).

That split *is* your workspace. On day one you do **not** add Cargo workspaces, pnpm workspaces, or a monorepo tool. Those are answers to problems you don't have yet — and knowing *when* to introduce them is part of the learning (Step 5).

Why does this split matter? Because it means the two devs can work in parallel from day one: Priyanshu builds the Rust side, Ashwani builds the web side, and they only need to agree on the contracts at the seam. The whole project architecture hangs off this idea (see [architecture.md](architecture.md) — "Rust owns durable truth; React owns presentation").

---

## Step 1 — Prerequisites, and why each one

```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Three things are required, and each exists for a specific reason:

| Prerequisite | Why you need it |
| :--- | :--- |
| **Rust** (via rustup) | `rustc` + `cargo` compile and run the entire core engine. Tauri needs the stable toolchain. |
| **Node.js LTS (20+) + pnpm** | Node runs the frontend build tooling (Vite). pnpm is this project's package manager — see [agents.md](../agents.md). Note: the README says Node 18+ as a floor; current Vite wants 20.19+, so use a current LTS. |
| **Tauri system dependencies** | Platform-specific native libraries (Linux: `webkit2gtk-4.1-dev`, `libayatana-appindicator-dev`, ...). These are what the **OS webview** — the thing that actually renders your React UI as a native window — needs to exist. See <https://v2.tauri.app/start/prerequisites>. |

The GPU (NVIDIA RTX 3060+ / Apple M-series) is **not** on this list. It's only needed later for local LLM inference (Feature 7+). Installing prerequisites for features you haven't started yet is how you accumulate setup debt.

Verify before moving on: `rustc --version`, `cargo --version`, `node --version`, `pnpm --version`.

---

## Step 2 — Scaffold, and what it actually does

```bash
pnpm create tauri-app
```

Interactive prompts:

| Prompt | Answer |
| :--- | :--- |
| Project name | `yapbook` |
| Frontend language | TypeScript |
| UI template | React |
| Package manager | pnpm |

**What this one command does for you** (the work it would take hours to do by hand):

1. Writes the **Rust crate**: `src-tauri/` with `Cargo.toml`, `main.rs`/`lib.rs`, `tauri.conf.json`, and a `capabilities/` folder.
2. Writes the **React + Vite frontend**: `src/`, `vite.config.ts`, `package.json`.
3. Wires the **pnpm scripts** (`dev`, `tauri`, `build`) so one command launches the whole thing.

Why `pnpm create tauri-app` and not the alternative? The other path — `cargo install tauri-cli` (or `pnpm add -D @tauri-apps/cli`) then `cargo tauri init` — is for when you *already have a frontend* and just want to add Tauri to it. For a fresh start, `create-tauri-app` generates both sides coherently, which is exactly the state you want to learn from.

---

## Step 3 — Read what you got (the most valuable 20 minutes)

Before adding a single dependency, open the generated files and **map them to your milestones**. This is the step that turns "a bunch of boilerplate" into "I understand my project":

| Generated file | What it is | What it maps to |
| :--- | :--- | :--- |
| `src-tauri/src/lib.rs` | Where `#[tauri::command]` functions live, registered by `invoke_handler!` | **P1** — this is Priyanshu's starting point |
| `src-tauri/capabilities/default.json` | Tauri's permission allowlist | **D-001** — the security model: *nothing is enabled by default*, every plugin/permission is an explicit grant |
| `tauri.conf.json` | Window config, app identifier, bundler settings | **P1 / A1** — shell config |
| `src/services/` (once created) | The IPC wrapper with a mock fallback mode | **A1** — lets Ashwani run the UI in a plain browser with no Rust |

The key insight: `capabilities/default.json` being empty by default is **not a bug, it's the feature**. It's the whole reason we chose Tauri over Electron (decision [D-001](decisions.md#d-001--desktop-framework-tauri-v2)) — private chat data gets a permission system that is closed by default. Notice it now; it'll make sense why every plugin needs explicit grants later.

---

## Step 4 — Minimal dependencies (the "not everything at once" part)

Only what Feature 1 needs — a working window, typed IPC, and a styled shell:

```bash
# Frontend — Tailwind for the A1 shell styling (v4 is CSS-first: no config file)
pnpm add tailwindcss @tailwindcss/vite

# Rust — async runtime, serialization, subprocess capability, typed errors
cd src-tauri
cargo add tokio --features rt-multi-thread,macros,sync
cargo add serde --features derive
cargo add serde_json
cargo add thiserror
cargo add tauri-plugin-shell@2
```

**Why each one:**

| Dependency | Why it's here now |
| :--- | :--- |
| `tokio` | The async runtime — P1 needs `spawn_blocking` (so CPU-heavy work never stalls the IPC loop), `mpsc` channels (the future DB writer actor), and `async main`. |
| `serde` + `serde_json` | The serialization layer — your Rust structs cross the IPC boundary as JSON. No serde, no typed commands. |
| `thiserror` | The typed `AppError` enum (P1) — structured errors the frontend can display, instead of raw strings. |
| `tauri-plugin-shell` | Subprocess spawning — needed later when the supervisor launches `llama-server` (Feature 7). Add the crate now; the capability gate can wait until P6. |
| `tailwindcss` + `@tailwindcss/vite` | The A1 shell styling. v4 is CSS-first: add the plugin to `vite.config.ts`, replace the template's main CSS with `@import "tailwindcss";`. |

**Equally important — what NOT to add, and why:**

| Dependency | Arrives with | Why not now |
| :--- | :--- | :--- |
| `rusqlite` (WAL persistence) | Feature 5 (P4) | No persistence exists yet — the DB actor pattern needs a design first |
| `reqwest` (HTTP client) | Features 7 / 14 (P6 / P12) | No `llama-server` to talk to, no model to download yet |
| `image`, `ab_glyph` (compositor) | Feature 13 (P11) | No rendered panels to composite yet |
| `llama-server` binary + model (~4.5 GB) | Features 7 / 14 | The single biggest "do not install early" — it's a 4.5 GB download for a feature 3 sprints away |
| Chart.js / Fabric.js | Features 4 / 12 (A2 / A6) | No data to chart, no canvas to edit yet |

The roadmap already tells you *when* each dependency arrives. Trust it. Adding a dependency before its feature is how projects accumulate dead weight — every unused dep is a security surface, a build-time cost, and a concept you have to explain later.

---

## Step 5 — When (not if) to introduce real workspaces

You already have a workspace (Step 1). Here's when the *extra* workspace tooling earns its place:

- **Cargo workspace** — introduce `[workspace] members = ["crates/parser", "crates/analytics", ...]` under `src-tauri/` **only when Priyanshu actually splits modules into separate crates**, e.g. when the parser outgrows a single file in Feature 2. A single crate is fine until then.
- **pnpm workspace** — only if you introduce a shared TypeScript package (e.g. `packages/types`). Per [D-007](decisions.md#d-007--contracts-manually-authored-types), contracts are hand-maintained on both sides, so a shared types package is **optional**. Skip it until the duplication actually hurts.
- **`benchmarks/chat-stats/`** — a standalone pnpm project with its own lockfile (`pnpm-lock.yaml`). Leave it independent; benchmark tooling shouldn't share dependencies with the app.

The rule to internalize: **introduce workspace tooling when the structure demands it, not because it looks professional.** A monorepo with two empty packages is not a sign of maturity — it's two empty packages.

---

## Step 6 — Verify (and what you're actually proving)

```bash
pnpm install
pnpm tauri dev           # launches the app window with HMR
```

Then the Feature 1 smoke test: replace the template's sample command (usually `greet`) with `ping`, call `invoke('ping')` from the frontend, and see `"pong"` in the webview console.

That one round-trip proves the **entire seam works**: webview → IPC bridge → Rust command → result back to webview. If this works, every feature that follows (analytics, events, jobs) is just more commands on the same seam. If it doesn't, there's no point building anything else until it does — this is the foundation P1 is about.

Also confirm `cargo check` passes inside `src-tauri/` — cheap insurance that the Rust side is sound.

---

## Exercises to actually learn it

1. **Trace the IPC path.** Read `src-tauri/src/lib.rs` and follow how `#[tauri::command]` + `invoke_handler!` exposes a Rust function, then how `invoke()` reaches it from React. This seam is the one concept everything else in the project builds on — understanding it once pays off forever.
2. **Read `capabilities/default.json`.** Ask yourself why it's empty by default. That's the security model you chose (D-001) — and it's why private chat data is safe in this app.
3. **Add your own command.** `fn add(a: i32, b: i32) -> i32` — wire it through `invoke_handler!`, call it from React with typed arguments. You'll have written your first real backend-to-frontend interaction.
4. **Change the window.** Edit the title and size in `tauri.conf.json`, restart `pnpm tauri dev`, and see it apply. Small, but it makes the config file feel yours.

---

## Where to go next

- [Master Roadmap](milestones.md) — Feature 1 is the first thing both devs build; P1 (Priyanshu) and A1 (Ashwani) both start there
- [Shared Contracts](contracts.md) — the seam you just exercised, formalized
- [Decision Log](decisions.md) — why Tauri (D-001) and why hand-authored contracts (D-007), in one place
