# Yapbook — Processing Time Calculations

> Estimating wall-clock time across the full pipeline for 50K → 10M messages.

---

## Corrections to Architecture Doc

Before the numbers — addressing your two points:

### 1. No Media in v1

Agreed. Dropping media support from v1 removes:
- Media Extractor & Cataloger (entire component)
- Thumbnail generation
- Media-to-message linking
- Media type classification
- Large file handling during archive extraction

The input becomes: **a single `.txt` file inside a `.zip`**. This massively simplifies Phase 1. The parser only needs to handle text, links, and system messages. `<Media omitted>` lines get flagged but not resolved.

### 2. Sender Names Are Stable

You're right — WhatsApp snapshots all contact names **at export time**, so "Priyanshu" is "Priyanshu" from the first message to the last. The complex sender normalization / alias merging I described is unnecessary.

The only edge case remaining is the **exporter's own messages**, which may appear without a name prefix or with a phone number depending on platform/version. This is a single mapping the user confirms at import time, not an ongoing resolution problem.

---

## Assumptions

Before running numbers, establishing the key variables:

| Variable | Value | Rationale |
|----------|-------|-----------|
| Avg tokens per WhatsApp message | **15 tokens** | WhatsApp messages are short. "haha ok coming in 5" = 7 tokens. "bro did you see what happened at the party last night that was insane 😂😂" = 20 tokens. 15 is a reasonable mean. |
| Avg messages per session | **50 messages** | Using 30-min inactivity gap. Active bursts average 50 msgs, ranging from 5 (quick exchange) to 300+ (heated debate). |
| Session overhead (system prompt + memory context) | **4,000 tokens** | ~500 tokens system prompt + ~3,500 tokens memory context (compressed profiles, recent summaries, relationship snapshot). |
| LLM output per session | **600 tokens** | Session summary (~100), key events (~150), member observations (~200), relationship notes (~100), culture flags (~50). |
| Periodic synthesis frequency | **Every 50 sessions** | Narrative layer synthesis (arcs, eras) — heavier LLM call. |
| Synthesis output | **2,000 tokens** | Longer, more reflective generation. |

---

## Stage-by-Stage Breakdown

### Stage 1: Parsing

**Operation:** Read `.txt` file, regex-match message lines, build structured message objects.

This is pure text processing — CPU-bound, single-threaded is fine.

| Messages | Raw Text Size | Parse Time |
|----------|--------------|------------|
| 50K | ~4 MB | < 1 second |
| 100K | ~8 MB | ~1 second |
| 500K | ~40 MB | ~3 seconds |
| 1M | ~80 MB | ~5 seconds |
| 10M | ~800 MB | ~30-45 seconds |

**Bottleneck?** No. Entirely negligible.

---

### Stage 2: Analytics

**Operation:** O(n) passes over the message array computing metrics — word frequencies, temporal distributions, reply chains, etc.

Multiple independent metric calculators, each doing a single pass. Can be parallelized across CPU cores.

| Messages | Compute Time | Notes |
|----------|-------------|-------|
| 50K | ~2 seconds | Trivial |
| 100K | ~4 seconds | Trivial |
| 500K | ~15 seconds | Word frequency maps get large |
| 1M | ~30 seconds | HashMap overhead grows |
| 10M | ~3-5 minutes | Memory pressure becomes a factor; may need streaming |

**Bottleneck?** No. Visualization rendering adds a few seconds on top but is also negligible.

---

### Stage 3: Session Segmentation

#### Strategy A — Inactivity Gap (recommended for v1)

**Operation:** Linear scan, break when `gap > threshold`. Pure timestamp comparison.

| Messages | Sessions Produced | Time |
|----------|------------------|------|
| 50K | ~1,000 | < 1 second |
| 100K | ~2,000 | < 1 second |
| 500K | ~10,000 | ~1 second |
| 1M | ~20,000 | ~2 seconds |
| 10M | ~200,000 | ~10 seconds |

#### Strategy B — Embedding-Based Topic Drift (future enhancement)

If we add topic-aware segmentation using a local embedding model (e.g., `all-MiniLM-L6-v2`):

| Hardware | Embedding Speed | 50K msgs | 1M msgs | 10M msgs |
|----------|----------------|----------|---------|----------|
| GPU (RTX 3060+) | ~3,000 emb/s | 17s | 5.5 min | 55 min |
| CPU (modern 8-core) | ~300 emb/s | 2.7 min | 55 min | 9.2 hrs |
| Apple Silicon M2 | ~800 emb/s | 1 min | 21 min | 3.5 hrs |

**Bottleneck?** Strategy A: no. Strategy B: moderate, especially on CPU at high message counts. Worth deferring to v2.

---

### Stage 4: LLM Memory Processing — THE BOTTLENECK

This is where the time lives. Let's break it down precisely.

#### Token Budget Per Session

```
┌──────────────────────────────────────────────┐
│           INPUT TOKENS (~4,750)              │
│                                              │
│  System Prompt ................ 500 tokens   │
│  Memory Context:                             │
│    - Member profiles (compressed) . 1,500    │
│    - Recent session summaries (3) .. 600     │
│    - Relationship snapshot ......... 800     │
│    - Group culture notes ........... 600     │
│  Session Messages (50 × 15) ....... 750     │
│                                              │
├──────────────────────────────────────────────┤
│           OUTPUT TOKENS (~600)               │
│                                              │
│  Session summary .............. 100 tokens   │
│  Key events/moments ........... 150 tokens   │
│  Member observations .......... 200 tokens   │
│  Relationship updates ......... 100 tokens   │
│  Culture/joke flags ............ 50 tokens   │
│                                              │
└──────────────────────────────────────────────┘
```

#### LLM Inference Speeds — Real-World Benchmarks

These are realistic speeds for **quantized models via ollama/llama.cpp** under sustained load:

| Model | Hardware | Prefill (tok/s) | Decode (tok/s) |
|-------|----------|:-:|:-:|
| **Llama 3.1 8B Q4** | RTX 4070 (12GB) | 2,500 | 65 |
| **Llama 3.1 8B Q4** | RTX 3060 (12GB) | 1,200 | 40 |
| **Llama 3.1 8B Q4** | Apple M2 Pro (16GB) | 800 | 35 |
| **Llama 3.1 8B Q4** | CPU-only (16-core) | 100 | 10 |
| **Qwen 2.5 14B Q4** | RTX 4070 (12GB) | 1,400 | 40 |
| **Qwen 2.5 14B Q4** | RTX 4090 (24GB) | 2,800 | 55 |
| **Llama 3.1 70B Q4** | RTX 4090 + CPU offload | 200 | 12 |
| **Llama 3.1 70B Q4** | 2× RTX 4090 | 600 | 22 |

> [!IMPORTANT]
> **Decode speed is the dominant factor**, not prefill. Generating 600 output tokens at 40 tok/s = 15 seconds. Prefilling 4,750 input tokens at 1,200 tok/s = 4 seconds. The output generation is 3-4× slower per session than input processing.

#### Per-Session Processing Time

| Hardware | Model | Prefill Time | Decode Time | **Total/Session** |
|----------|-------|:--:|:--:|:--:|
| RTX 4070 | 8B | 1.9s | 9.2s | **11.1s** |
| RTX 3060 | 8B | 4.0s | 15.0s | **19.0s** |
| Apple M2 Pro | 8B | 5.9s | 17.1s | **23.0s** |
| CPU-only | 8B | 47.5s | 60.0s | **107.5s** |
| RTX 4090 | 14B | 1.7s | 10.9s | **12.6s** |
| RTX 4070 | 14B | 3.4s | 15.0s | **18.4s** |
| RTX 4090 + offload | 70B | 23.8s | 50.0s | **73.8s** |

#### Raw Processing Times (No Optimization)

Every session gets a full LLM call. No batching, no filtering.

**8B Model — RTX 4070 (11.1s/session):**

| Messages | Sessions | Wall Time | Human Time |
|----------|:--:|:--:|:--|
| 50K | 1,000 | 11,100s | **3.1 hours** |
| 100K | 2,000 | 22,200s | **6.2 hours** |
| 500K | 10,000 | 111,000s | **30.8 hours** (1.3 days) |
| 1M | 20,000 | 222,000s | **61.7 hours** (2.6 days) |
| 10M | 200,000 | 2,220,000s | **616.7 hours** (25.7 days) |

**8B Model — RTX 3060 (19.0s/session):**

| Messages | Sessions | Wall Time | Human Time |
|----------|:--:|:--:|:--|
| 50K | 1,000 | 19,000s | **5.3 hours** |
| 100K | 2,000 | 38,000s | **10.6 hours** |
| 500K | 10,000 | 190,000s | **52.8 hours** (2.2 days) |
| 1M | 20,000 | 380,000s | **105.6 hours** (4.4 days) |
| 10M | 200,000 | 3,800,000s | **1,055.6 hours** (44 days) |

**8B Model — CPU Only (107.5s/session):**

| Messages | Sessions | Wall Time | Human Time |
|----------|:--:|:--:|:--|
| 50K | 1,000 | 107,500s | **29.9 hours** (1.2 days) |
| 100K | 2,000 | 215,000s | **59.7 hours** (2.5 days) |
| 500K | 10,000 | 1,075,000s | **298.6 hours** (12.4 days) |
| 1M+ | — | — | **Infeasible** |

**14B Model — RTX 4090 (12.6s/session):**

| Messages | Sessions | Wall Time | Human Time |
|----------|:--:|:--:|:--|
| 50K | 1,000 | 12,600s | **3.5 hours** |
| 100K | 2,000 | 25,200s | **7.0 hours** |
| 500K | 10,000 | 126,000s | **35.0 hours** (1.5 days) |
| 1M | 20,000 | 252,000s | **70.0 hours** (2.9 days) |

> [!CAUTION]
> At 10M messages, even the fastest local setup takes **nearly a month** of continuous processing. 10M messages on CPU is completely infeasible locally. This is where cloud inference or architectural optimizations become mandatory.

#### Periodic Synthesis Overhead

Every ~50 sessions, a heavier narrative synthesis call runs:
- Input: ~8,000 tokens (accumulated episodic summaries + current semantic memory)
- Output: ~2,000 tokens

| Messages | Synthesis Calls | Added Time (RTX 4070, 8B) |
|----------|:-:|:--|
| 50K | 20 | ~10 minutes |
| 100K | 40 | ~20 minutes |
| 1M | 400 | ~3.3 hours |

Not negligible at scale, but dwarfed by session processing time.

---

### Stage 5: Comic Generation

For completeness — this stage is fast relative to Stage 4.

**Script Generation (LLM):**
- 20-50 scenes selected
- ~30 seconds per scene (LLM call to write panel script)
- Total: **10-25 minutes**

**Image Generation (Diffusion model, e.g. SDXL/Flux):**

| Hardware | Time per Panel | 30 Panels | 50 Panels |
|----------|:--:|:--:|:--:|
| RTX 4070 | ~12s | 6 min | 10 min |
| RTX 3060 | ~20s | 10 min | 17 min |
| Apple M2 Pro | ~45s | 22 min | 38 min |
| CPU | ~5 min | 2.5 hrs | 4.2 hrs |

**Panel Composition & Export:** Seconds. Pure image manipulation.

**Bottleneck?** No. 15-45 minutes total on GPU hardware. Not even close to Stage 4.

---

## Optimization Strategies

The raw numbers are sobering. Here's how to bring them down:

### 1. Session Filtering

Not every session deserves full LLM analysis. A session with 3 messages saying "ok", "coming", "👍" adds nothing.

**Filter criteria:**
- Skip sessions with < 5 messages
- Skip sessions where avg message length < 3 words (logistical chatter)
- Skip sessions that are purely system messages

**Impact:** Typically eliminates 30-50% of sessions.

### 2. Session Batching

Small sessions (5-15 messages) can be packed together into one LLM call, amortizing the overhead.

**Example:** Three 10-message sessions batched into one call:
- Without batching: 3 × (4,750 input + 600 output) = 16,050 tokens across 3 calls
- With batching: 1 × (4,000 overhead + 450 messages + 1,200 output) = 5,650 tokens in 1 call
- **~65% token reduction** for small sessions

**Impact:** Reduces effective session count by 2-3× for small sessions.

### 3. Tiered Processing

Not every session needs the same depth of analysis.

| Tier | Criteria | Processing | Output |
|------|----------|-----------|--------|
| **Quick** | < 15 messages, low intensity | 1-line summary only | ~50 tokens |
| **Standard** | 15-100 messages | Full session analysis | ~600 tokens |
| **Deep** | > 100 messages, high intensity, many participants | Extended analysis + moment scoring | ~1,200 tokens |

**Impact:** Reduces average output tokens from 600 to ~300, nearly halving decode time.

### 4. Parallel Independent Analysis

Some LLM tasks don't require sequential processing:
- **Moment scoring** can happen in parallel after initial sequential pass
- **Character arc synthesis** for different members can run concurrently
- **Multiple small models** for simple tasks (summarization) + one larger model for synthesis

### 5. Speculative: Model Distillation

For very large chats: do a first pass with an 8B model for basic extraction, then run a selective second pass with a 14B/70B model only on the most interesting sessions.

### Combined Optimization Estimate

Applying filtering (40% reduction) + batching (2× for small sessions) + tiered output (~50% decode reduction):

**Effective multiplier: ~0.25-0.35× raw time**

| Messages | Raw (4070, 8B) | **Optimized** |
|----------|:--:|:--:|
| 50K | 3.1 hrs | **0.8 - 1.1 hrs** |
| 100K | 6.2 hrs | **1.6 - 2.2 hrs** |
| 500K | 30.8 hrs | **7.7 - 10.8 hrs** |
| 1M | 61.7 hrs | **15.4 - 21.6 hrs** |
| 10M | 616.7 hrs | **154 - 216 hrs** (still 6-9 days) |

---

## Cloud Inference Comparison

For context, here's what cloud APIs look like:

| Provider | Model | Input Cost (/1M tok) | Output Cost (/1M tok) | Speed (decode tok/s) |
|----------|-------|:--:|:--:|:--:|
| OpenAI | GPT-4.1-mini | $0.40 | $1.60 | ~4,000 |
| OpenAI | GPT-4.1-nano | $0.10 | $0.40 | ~6,000 |
| Google | Gemini 2.0 Flash | $0.10 | $0.40 | ~3,000 |
| Anthropic | Claude Haiku 3.5 | $0.80 | $4.00 | ~2,000 |

**Per session cost (4,750 in + 600 out) — using GPT-4.1-nano:**
- Input: 4,750 × $0.10/1M = $0.000475
- Output: 600 × $0.40/1M = $0.000240
- **Total per session: ~$0.0007**

**Per session time:** ~1-2 seconds (dominated by network latency, not compute)

| Messages | Sessions | Cloud Time | Cloud Cost (nano) |
|----------|:--:|:--:|:--:|
| 50K | 1,000 | ~17 min | **$0.72** |
| 100K | 2,000 | ~33 min | **$1.43** |
| 500K | 10,000 | ~2.8 hrs | **$7.15** |
| 1M | 20,000 | ~5.6 hrs | **$14.30** |
| 10M | 200,000 | ~56 hrs | **$143.00** |

> [!NOTE]
> Cloud is 10-50× faster than local for the same quality tier. At 10M messages, cloud still takes ~2.3 days but costs ~$143 for a nano-tier model. Rate limits (requests per minute) become the real bottleneck with cloud at scale — at 10K RPM, 200K sessions takes ~20 minutes of pure request time, but sustained throughput will be lower.

---

## Summary — Where Does the Time Go?

```
For a 100K message chat on an RTX 4070 with an 8B model:

Parsing:            ██ 1 second
Analytics:          ██ 4 seconds
Segmentation:       ██ <1 second
LLM Processing:     ████████████████████████████████████████████████████ 1.6 - 6.2 hours
Comic Script Gen:   ████ ~15 minutes
Image Generation:   ██████ ~10 minutes
Panel Composition:  ██ seconds

Total:              ~2 to 7 hours
```

**The LLM memory processing stage accounts for 95%+ of total processing time.** Everything else combined is under 30 minutes even at 10M messages.

The primary knobs for reducing this:
1. **Better hardware** (GPU quality directly maps to throughput)
2. **Smarter session handling** (filter, batch, tier)
3. **Cloud offloading** (10-50× faster, at monetary cost)
4. **Smaller output requirements** (less verbose per session, synthesize less often)
5. **Future: speculative decoding & faster inference engines** (vLLM, SGLang — though these are server-oriented today)
