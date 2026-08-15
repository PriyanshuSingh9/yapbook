# Ashwani's Track — Frontend, UI/UX, Studio Canvas & Image Generation

> This is Ashwani's dedicated development roadmap for Yapbook. It focuses on building high-polish React interfaces, interactive charts, the comic editor studio, and **owning the complete Image Generation Pipeline** (character consistency, cloud diffusion gateway, prompt synthesis, and art styles).
>
> For system context and core engine dependencies, see the [Master Roadmap](../milestones.md) and [Architecture](../architecture.md).

---

## Progress Tracker

```
[ ] Feature A1 — Desktop Shell UI & Layout Scaffold                         (Sprint 1)
[ ] Feature A2 — Interactive Analytics & Group Dashboard UI                  (Sprint 1)
[ ] Feature A3 — Session Inspector & Memory Explorer UI                      (Sprint 2)
[ ] Feature A4 — Character Visual Archetypes & Consistency System            (Sprint 3)
[ ] Feature A5 — Cloud Image Gateway, Prompt Engine & Privacy Anonymizer     (Sprint 3)
[ ] Feature A6 — Comic Studio Canvas & Speech Bubble Layout Engine           (Sprint 4)
[ ] Feature A7 — Model Download Wizard & First-Run Onboarding UX             (Sprint 5)
[ ] Feature A8 — Theme Polish, UI Hardening & User Experience QA             (Sprint 5)
```

---

## Working Philosophy

### Your Domain

* **Frontend & UX**: React 19, TypeScript, Vite, TailwindCSS, Chart.js / Recharts, HTML5 Web Canvas / Fabric.js.
* **Image Generation & Visual Direction**:
  - Character visual archetype synthesis & turnaround reference sheets.
  - Image generation provider gateway (fal.ai / Replicate / Flux / SDXL).
  - Visual prompt engineering, camera staging, and art style preset engine.
  - Pre-flight privacy anonymizer (ensuring zero real names or PII leak to cloud APIs).
  - Studio re-roll workflow, single-panel regenerating, and cost governor.

### Core Invariant

> **"Rust owns durable truth and orchestration. Workers perform computation. React owns presentation and interaction."**

You do not implement durability, inference, or pipeline logic. You render what the backend tells you to render and send user intent back over IPC.

### Shared Type Contracts

All components consume strongly-typed interfaces defined collaboratively with Priyanshu in [contracts.md](../contracts.md):
- Analytics data and heatmap reports
- Session boundaries and event provenance
- Character archetype models and reference sheet URLs/hashes
- Storyboard panel descriptions, scene prompts, and image generation job status
- Comic studio canvas layouts and vector speech bubbles

### The "Zero-Wait" Rule

You do **not** need to wait for Priyanshu's Rust backend to build your UI or image pipeline. Use local mock fixtures (`benchmarks/chat-stats/report.json`, `fixtures/mock_storyboard.json`, and sample panel PNGs in `public/fixtures/`) to build and test 100 % of your screens and prompt engines in `pnpm run dev`.

---

## Feature A1 — Desktop Shell UI & Layout Scaffold

> Master roadmap reference: [Feature 1 — Foundation & Tauri v2 Shell](../milestones.md#feature-1--foundation--tauri-v2-shell)

### What You're Building

The application shell: frameless window controls, collapsible navigation sidebar, page routing, and global notification system. This is the container that every other view lives inside.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Sidebar behavior | Collapsible with icon-only compact mode | Always visible full-width | Try both; measure how much viewport space is lost on 1366×768 screens |
| View transitions | Animated fade/slide between tabs | Instant swap (no animation) | If animation feels sluggish on low-end Webview, remove it |
| Toast notifications | Non-intrusive bottom-right stack | Modal dialogs | Modals block interaction — avoid unless the notification is truly critical |

### What to Build

- Custom frameless titlebar with window drag region (`data-tauri-drag-region`) and native-feeling controls
- Sidebar with navigation tabs: Import, Analytics, Sessions, Comic Studio, Settings
- Responsive layout that works on monitors from 1366×768 to ultrawide
- StatusBar showing current project name, model status, and pipeline state
- Toast notification provider for non-blocking alerts
- File import dropzone supporting drag-and-drop of `.zip` and `.txt` files
- IPC wrapper in `services/api.ts` with a mock fallback mode so everything works in `pnpm run dev`

### How to Verify

- `pnpm run dev` opens a dark-themed layout with working tab navigation
- Sidebar collapse toggle works smoothly
- File dropzone accepts drag-and-drop and shows file metadata
- `cargo tauri dev` shows the same UI inside the native window with working window controls

---

## Feature A2 — Interactive Analytics & Group Dashboard UI

> Master roadmap reference: [Feature 4 — Analytics Dashboard UI](../milestones.md#feature-4--analytics-dashboard-ui)

### What You're Building

The visual analytics suite. This is the first thing users see after importing a chat — it needs to immediately communicate value and feel responsive.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Chart library | Chart.js (Canvas-based, handles 365 data points) | Recharts (declarative React API, SVG-based) | Benchmark both with 365-day dataset; pick whichever hits 60 FPS |
| Heatmap rendering | Tailwind-styled grid elements (CSS tooltips) | Canvas 2D draw (faster, no DOM overhead) | CSS gives you crisp hover states; Canvas gives you better performance at scale |
| Tab organization | 4–5 tabs (Overview, Members, Heatmap, Social, Milestones) | Single scrollable page | Tabs prevent overwhelming the user; test with non-technical friends |

### What to Build

- **Overview tab**: KPI summary cards (total messages, active days, messages/day, Hinglish ratio), volume timeline chart
- **Members tab**: Contribution share cards, emoji leaderboards, message length badges, conversation initiation scores
- **Activity Heatmap tab**: 7×24 hour-of-day vs day-of-week grid with color intensity scaling and hover tooltips
- **Social Graph tab**: Interactive N×N directional reply matrix showing who talks to whom
- **Milestones tab**: Vertical timeline showing group creation, first message, 10 k / 50 k milestones
- Mock data toggle: in dev mode, auto-load `benchmarks/chat-stats/report.json`

### How to Verify

- All charts render smoothly with the 126 K dataset loaded from mock JSON
- Tab switching is instantaneous (no re-render lag)
- Hover tooltips on every chart show correct values
- Volume chart handles daily granularity (365+ data points) without jank

---

## Feature A3 — Session Inspector & Memory Explorer UI

> Master roadmap reference: [Feature 6](../milestones.md#feature-6--session-segmenter--signal-gate), [Feature 8](../milestones.md#feature-8--event-extraction--provenance-validation), [Feature 9](../milestones.md#feature-9--memory-synthesis)

### What You're Building

An interactive explorer where users inspect detected sessions, view extracted events, and trace any comic moment back to its exact source WhatsApp messages. This is the provenance UI — it builds trust by showing users how AI conclusions connect to real conversation.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Session list rendering | Virtualized list (react-window / react-virtuoso) | Paginated list | If you have 1,000+ sessions, DOM-based lists will lag |
| Chat bubble style | WhatsApp-inspired (colored by sender) | Plain text with sender prefix | WhatsApp-style creates instant recognition |
| Provenance highlighting | Yellow/gold background on evidence messages | Sidebar annotation panel | In-line highlighting is more intuitive than a separate panel |

### What to Build

- Session list with search and filter (by member, date, high/low signal)
- Session detail view: duration, participant badges, richness score, extracted events
- WhatsApp-style chat message bubbles with sender name colors and timestamps
- Provenance highlighter: when user clicks an event, scroll to and highlight the exact messages that substantiated it
- Member profiles drawer: slide-out panel showing personality traits, communication style, running jokes
- All data from mock fixtures until backend contracts are live

### How to Verify

- Session list handles 1,000+ sessions without scroll lag
- Clicking an extracted event scrolls to the correct source messages and highlights them
- Filters produce correct results (only high-signal sessions, only sessions containing a specific member)
- Member profiles drawer shows meaningful content from mock data

---

## Feature A4 — Character Visual Archetypes & Consistency System

> Master roadmap reference: [Feature 11 — Character Bootstrapping & Image Pipeline](../milestones.md#feature-11--character-bootstrapping--image-pipeline)

### The Problem

A comic book fails if characters change hair, face shape, glasses, or clothing randomly across panels. Because WhatsApp chats lack profile images, we must bootstrap a consistent visual identity for each member based on their personality profile, then anchor every panel generation to that identity.

### Architecture & Pipeline Flow

```
LLM Member Profile (Priyanshu's Memory Synthesis)
        |
        v
1. Visual Archetype Synthesis:
   Convert personality & age into concrete visual descriptors:
   "Character A: Indian young man in mid-20s, unruly wavy black hair, round wireframe glasses,
    olive skin, emerald green hoodie over white tee, slightly mischievous smirk."
        |
        v
2. 3-View Turnaround Reference Sheet Generation:
   Call Cloud Diffusion (Flux / SDXL) with specialized prompt:
   "Character turnaround sheet, 3 views: front view, three-quarter view, profile view.
    Clean graphic novel style, solid neutral background, consistent character design."
        |
        v
3. Reference Sheet Stored & Indexed (Cached in artifacts/objects/{hash}.png)
        |
        v
4. Downstream Panel Anchoring:
   Pass reference sheet image + visual anchor prompt to all panel generation calls
```

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Consistency Method | Visual turnaround sheet + image-conditioned IP-Adapter / Flux reference | Pure text prompt repetition ("boy with green hoodie...") | Pure text drifts significantly across different angles and lighting; reference sheet anchors facial structure |
| Archetype Editing | Allow user to tweak character appearance in UI (hair color, clothing, glasses) | Auto-generate only (no edit) | Users love customizing how their friends look before generating the comic |
| Art Style Presets | Curated Style Tokens (Comic, Webtoon, Manga, Noir, Cartoon) | Free-form user style prompt | Curated presets guarantee high quality; free-form prompts often produce chaotic panel mixes |

### What to Build

- **Archetype Generator (`services/characterArchetype.ts`)**:
  Maps member personality traits to visual attributes (hair, eyewear, outfit, dominant color, posture).
- **Turnaround Sheet Prompt Builder**:
  Constructs multi-view generation prompts ensuring neutral lighting and consistent proportions.
- **Character Customizer Modal (`src/components/studio/CharacterCustomizer.tsx`)**:
  UI modal displaying generated character reference sheets with editable visual tags (e.g. swap "hoodie" for "denim jacket").
- **Art Style Preset Engine**:
  * *Graphic Novel / Western Comic*: Dynamic ink linework, cel shading, rich shadows.
  * *Modern Webtoon*: Clean digital art, expressive anime-influenced eyes, vibrant pastel colors.
  * *Manga / Noir*: High-contrast black & white, screen tones, dramatic rim lighting.
  * *Indie Cartoon*: Playful stylized proportions, colorful shapes, lighthearted vibe.

### How to Verify

- System generates 3-view turnaround sheets for all group members from mock memory profiles
- Character sheets have clear front, 3/4, and profile views against neutral backgrounds
- User edits in the customizer modal update the character's visual prompt payload

---

## Feature A5 — Cloud Image Gateway, Prompt Engine & Privacy Anonymizer

> Master roadmap reference: [Feature 11 — Character Bootstrapping & Image Pipeline](../milestones.md#feature-11--character-bootstrapping--image-pipeline)

### The Problem

We must convert storyboard panel descriptions into rich diffusion prompts, send them to cloud image generation APIs, and receive rendered images — **while strictly guaranteeing zero chat privacy leakage and staying within a defined user budget**.

### Architecture & Pipeline Flow

```
Storyboard Panel Spec:
{
  panelNumber: 2,
  sceneDescription: "Priyanshu excitedly shows Rahul a bus ticket on his phone.",
  charactersPresent: ["Priyanshu", "Rahul"],
  visualComposition: "Medium shot, Priyanshu on left smiling holding phone, Rahul looking skeptical on right",
  mood: "humorous excitement"
}
        |
        v
1. Anonymization & Token Replacement:
   "Priyanshu" ──► "Character A (wavy hair, round glasses, green hoodie)"
   "Rahul"     ──► "Character B (short buzzcut, athletic build, black bomber jacket)"
   Resulting prompt has ZERO real names, chat quotes, or phone numbers.
        |
        v
2. Automated Pre-Flight Privacy Audit:
   Regex scan against member whitelist: asserts 0 matches. If violation: abort immediately.
        |
        v
3. Style & Camera Composition Assembly:
   [Style Prefix] + [Scene Description] + [Character Visual Anchors] + [Camera/Lighting] + [Quality Tokens]
        |
        v
4. Cost Governor Check:
   Assert: (current_run_cost + panel_cost) <= user_budget_ceiling ($3.00 max)
        |
        v
5. Cloud Provider Dispatch (fal.ai / Replicate Flux Client):
   POST /fal-ai/flux/dev with image conditioning / reference URLs
        |
        v
6. Image Saved to artifacts/objects/{hash}.png via Rust Persistence
```

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Cloud Provider | **fal.ai** (Flux Schnell / Flux Dev) | Replicate / OpenAI DALL-E 3 | fal.ai offers fastest turnaround (< 3s/image), superior image quality via Flux, and competitive pricing (~$0.025–$0.04/image) |
| Privacy Gate | Automated pre-flight regex & PII validator | Manual confirmation | Automation is fail-safe; never rely on human prompt auditing |
| Budget Ceiling | $3.00 per comic run default (user-configurable) | Unlimited / Hard stop at $1.50 | 40 panels + 6 character sheets = ~$1.90; $3.00 allows headroom for re-rolls |
| Local Fallback | Cloud-first v1; optional ComfyUI local sidecar for high-end GPUs | Local diffusion only | Local diffusion requires 24 GB+ RAM and 8 GB+ VRAM; cloud makes Yapbook accessible to 100% of users |

### What to Build

- **Privacy Sanitizer (`services/image/anonymizer.ts`)**:
  Replaces real participant names, phone numbers, and exact message quotes with generic character visual archetypes (`Character A`, `Character B`).
- **Automated Pre-Flight Privacy Audit Test**:
  Unit test asserting that 1,000 randomized prompt generations contain zero matches from the chat member whitelist.
- **Diffusion Prompt Composer (`services/image/promptComposer.ts`)**:
  Combines art style preset, character visual descriptors, camera staging (wide, medium, close-up, Dutch angle), lighting (golden hour, neon, dramatic rim light), and negative prompts.
- **Provider API Client (`services/image/falClient.ts` / `replicateClient.ts`)**:
  Robust client with automatic retry, exponential backoff for rate limits, and progress event emission.
- **Cost Governor (`services/image/costGovernor.ts`)**:
  Tracks cumulative API usage per project/run, warns the user at 75 % budget, and enforces hard stop at ceiling.

### How to Verify

- Automated test passes: 0 real member names or quotes present in 50 simulated cloud generation payloads
- Generating a 4-panel test strip via fal.ai / Replicate returns crisp, correctly styled comic images in < 15 seconds
- Cost governor accurately calculates and limits total run expenditure under $3.00

---

## Feature A6 — Comic Studio Canvas & Speech Bubble Layout Engine

> Master roadmap reference: [Feature 12 — Comic Studio Canvas](../milestones.md#feature-12--comic-studio-canvas)

### What You're Building

The flagship interactive Comic Studio where users preview generated comic strips, drag and reposition speech bubbles, edit dialogue text inline, switch page layout templates, and trigger single-panel re-rolls.

### Key Decisions to Make

| Question | Recommended | Alternative | How to Decide |
| :--- | :--- | :--- | :--- |
| Canvas framework | Fabric.js (built-in object manipulation) | Raw HTML5 Canvas | Fabric.js gives you drag/drop/select and bounding boxes for free |
| Speech bubble rendering | SVG vector overlays | Rasterized canvas draw | SVG is resolution-independent, easily styled with CSS, and text wraps crisply |
| Re-roll interaction | In-place hover action on panel + prompt tuning modal | Re-run entire comic | In-place re-roll saves money and gives fine-grained control |

### What to Build

- **Multi-Panel Canvas (`src/components/studio/ComicCanvas.tsx`)**:
  Pan & zoom canvas supporting multiple page layouts ($2 \times 2$ Grid, 3-Panel Vertical Webtoon, 4-Panel Classic Strip, 6-Panel Graphic Novel).
- **Draggable Vector Speech Bubbles (`src/components/studio/SpeechBubble.tsx`)**:
  * SVG vector speech bubbles with customizable tail direction and dynamic pointer tail anchoring.
  * Comic-style typography with automatic line wrapping and auto-resizing bubble bounds.
  * Dialogue styles: Normal Speech, Whisper (dashed border), Shout (spiky starburst), Thought (cloud bubble).
- **Inline Text Editor**:
  Double-click dialogue bubble to edit text directly with instant layout re-calculation.
- **Panel Action Bar & Re-Roll Modal (`src/components/studio/ReRollModal.tsx`)**:
  * Hover overlay on each panel with buttons: "Re-roll Image", "Edit Scene Prompt", "Swap Left/Right".
  * Re-roll modal allows tweaking character expression, camera angle, or scene detail before re-generating that single panel.
- **Export Trigger**:
  "Export Comic" button triggering Priyanshu's native high-res 300 DPI PDF/PNG renderer.

### How to Verify

- All interactions (drag bubbles, pan/zoom canvas, edit dialogue) run at 60 FPS
- Dialogue edits persist across tab switches and are saved back to SQLite storyboard records
- Clicking "Re-roll" regenerates a single panel without disturbing surrounding panels or speech bubbles
- Layout template changes rearrange panels smoothly without losing bubble positions

---

## Feature A7 — Model Download Wizard & First-Run Onboarding UX

> Master roadmap reference: [Feature 14 — Model Download Manager & Onboarding](../milestones.md#feature-14--model-download-manager--onboarding)

### What You're Building

The onboarding modal that greets users on first launch, detects their hardware tier, guides them through downloading the AI model with pause/resume support, and configures image generation settings.

### What to Build

- Mock download event stream in `services/api.ts`: emit `{ downloaded_bytes, total_bytes, speed_mbps, status }` every 200 ms in dev mode
- Multi-step onboarding wizard dialog:
  * **Step 1: Hardware Summary**: GPU detected, VRAM, recommended LLM settings, image provider choice (Cloud API key setup vs Local).
  * **Step 2: Model Download**: Animated progress bar with download speed meter, ETA, and pause/resume buttons.
  * **Step 3: Checksum Validation**: Integrity verification animation.
  * **Step 4: Welcome & First Import**: "Ready to Create" screen with "Import Your First Chat" button.
- Disk space check warning if free disk space is $< 10\text{GB}$.

### How to Verify

- Wizard completes smoothly using mock event stream in browser mode
- Progress bar accurately reflects download speed and bytes
- Pause and resume work without UI glitches
- Entering cloud API key tests connection and validates key format

---

## Feature A8 — Theme Polish, UI Hardening & User Experience QA

> Master roadmap reference: [Feature 15 — Hardening & Multi-Platform CI/CD](../milestones.md#feature-15--hardening--multi-platform-cicd)

### What You're Building

Final visual polish across the entire application: dark/light theme tokens, keyboard shortcuts, error boundary resilience, and end-to-end UX smoothness.

### What to Do

- Audit light and dark theme contrast across all text, borders, charts, and speech bubbles (WCAG AA compliance)
- Keyboard shortcuts: `Ctrl+O` (import), `Space+Drag` (pan canvas), `Ctrl+Z` / `Ctrl+Y` (undo/redo bubble edits), `Ctrl+E` (export)
- Implement `ErrorBoundary.tsx`: React runtime errors show friendly recovery cards instead of a blank screen
- Add empty states with custom illustrations when no projects, sessions, or comics are loaded
- End-to-end UX walkthrough verifying zero layout jumps, no jank, and seamless transitions across resolutions (1366×768 to 4K)

### How to Verify

- Light and dark themes pass visual inspection with zero unreadable elements
- Keyboard shortcuts function reliably in the Studio Canvas
- Deliberately throwing an error in a component triggers the ErrorBoundary gracefully
- Full user flow (Import → Analytics → Sessions → Character Customize → Studio Edit → Export) completes smoothly with zero layout glitches
