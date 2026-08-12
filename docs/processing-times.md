# Yapbook — Processing Time Calculations

> Estimating wall-clock time across the full pipeline for 50K → 1M messages, updated with empirical benchmark data from `benchmarks/chat-stats/conclusion.md`.

---

## Benchmark-Validated Assumptions

Empirical testing on a real ~126K WhatsApp group chat (`WhatsApp Chat with आंतरिक मित्र मंडल`) produced the following validated metrics, superseding earlier estimates:

| Variable | Initial Assumption | Empirical Benchmark Value | Impact |
|----------|-------------------|--------------------------|--------|
| **Avg tokens per message** | 15.0 tokens | **5.5 tokens** | **-63% input tokens** — Chat messages are short, rapid banter. |
| **Avg messages per session (30-min)** | 50 messages | **120 messages** | Messages arrive in dense bursts rather than sparse exchanges. |
| **Session count per 100K msgs** | ~2,000 sessions | **~800 sessions** | **-60% fewer sessions** to summarize (1,026 for 126K msgs). |
| **Session overhead** | 4,000 tokens | **4,000 tokens** | System prompt + compressed profiles + recent summaries. |
| **LLM output per session** | 600 tokens | **600 tokens** | Summary + key events + observations + culture flags. |
| **Filterable sessions (< 5 msgs)** | ~10–15% | **28.6%** | **28.6% of sessions** carry negligible content. |
| **Noise message ratio** | ~20% | **35.7%** | Single-word, emoji-only, or media placeholders. |
| **Combined skip/fast-track ratio** | — | **~42%** | Low message count + low richness filtering. |

---

## Stage-by-Stage Breakdown

### Stage 1: Parsing

**Operation:** Read `.txt` file, regex-match message lines, build structured message objects.

Pure CPU-bound text processing.

| Messages | Raw Text Size | Parse Time |
|----------|--------------|------------|
| 50K | ~3 MB | < 1 second |
| 100K | ~6 MB | ~1 second |
| 500K | ~30 MB | ~2-3 seconds |
| 1M | ~60 MB | ~4-5 seconds |

**Bottleneck?** No. Entirely negligible.

---

### Stage 2: Analytics

**Operation:** O(n) passes over the message array computing volume, temporal, social, language, and signal metrics.

Can be parallelized across CPU cores.

| Messages | Compute Time | Notes |
|----------|-------------|-------|
| 50K | ~1-2 seconds | Trivial |
| 100K | ~3-4 seconds | Benchmark measured 3.2s for 126K msgs |
| 500K | ~12-15 seconds | HashMap overhead grows |
| 1M | ~25-30 seconds | Fast single-pass execution |

**Bottleneck?** No. Trivial compute overhead.

---

### Stage 3: Session Segmentation

#### Strategy: Inactivity Gap (30-min Default)

Linear scan, break when `gap > 30 min`.

| Messages | Estimated Sessions Produced | Time |
|----------|----------------------------|------|
| 50K | ~400 | < 1 second |
| 100K | ~800 | < 1 second |
| 500K | ~4,000 | ~1 second |
| 1M | ~8,000 | ~2 seconds |

**Bottleneck?** No.

---

### Stage 4: LLM Memory Processing — THE BOTTLENECK

This is where the wall-clock time lives.

#### Empirical Token Budget Per Session (30-min Gap)

```
┌──────────────────────────────────────────────┐
│           INPUT TOKENS (~4,660)              │
│                                              │
│  System Prompt ................ 500 tokens   │
│  Memory Context:                             │
│    - Member profiles (compressed) . 1,500    │
│    - Recent session summaries (3) .. 600     │
│    - Relationship snapshot ......... 800     │
│    - Group culture notes ........... 600     │
│  Session Messages (120 × 5.5) ..... 660     │
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

#### LLM Inference Speeds — Benchmarks

Realistic throughput for **quantized models via ollama / llama.cpp**:

| Model | Hardware | Prefill (tok/s) | Decode (tok/s) |
|-------|----------|:-:|:-:|
| **Llama 3.1 8B Q4** | RTX 4070 (12GB) | 2,500 | 65 |
| **Llama 3.1 8B Q4** | RTX 3060 (12GB) | 1,200 | 40 |
| **Llama 3.1 8B Q4** | Apple M2 Pro (16GB) | 800 | 35 |
| **Llama 3.1 8B Q4** | CPU-only (16-core) | 100 | 10 |
| **Qwen 2.5 14B Q4** | RTX 4070 (12GB) | 1,400 | 40 |

#### Per-Session Processing Time

| Hardware | Model | Prefill Time (4,660 tok) | Decode Time (600 tok) | **Total/Session** |
|----------|-------|:--:|:--:|:--:|
| RTX 4070 | 8B | 1.86s | 9.23s | **11.09s** |
| RTX 3060 | 8B | 3.88s | 15.00s | **18.88s** |
| Apple M2 Pro | 8B | 5.83s | 17.14s | **22.97s** |
| CPU-only | 8B | 46.60s | 60.00s | **106.60s** |

---

### Raw vs. Optimized Wall-Clock Times

#### Raw Processing Times (No Filtering/Batching)

**8B Model — RTX 4070 (11.09s / session):**

| Messages | Sessions | Raw Wall Time | Human Time |
|----------|:--:|:--:|:--|
| 50K | 400 | 4,436s | **1.2 hours** |
| 100K | 800 | 8,872s | **2.5 hours** |
| 500K | 4,000 | 44,360s | **12.3 hours** |
| 1M | 8,000 | 88,720s | **24.6 hours** (~1 day) |

**8B Model — RTX 3060 (18.88s / session):**

| Messages | Sessions | Raw Wall Time | Human Time |
|----------|:--:|:--:|:--|
| 50K | 400 | 7,552s | **2.1 hours** |
| 100K | 800 | 15,104s | **4.2 hours** |
| 500K | 4,000 | 75,520s | **21.0 hours** |
| 1M | 8,000 | 151,040s | **41.9 hours** (~1.7 days) |

**8B Model — CPU Only (106.6s / session):**

| Messages | Sessions | Raw Wall Time | Human Time |
|----------|:--:|:--:|:--|
| 50K | 400 | 42,640s | **11.8 hours** |
| 100K | 800 | 85,280s | **23.7 hours** |
| 500K | 4,000 | 426,400s | **118.4 hours** (4.9 days) |
| 1M | 8,000 | 852,800s | **236.9 hours** (9.8 days) |

---

### Optimized Processing Times

Applying our benchmark-validated optimization pipeline:
- **Filtering** (<5 msgs + low richness score): **-42% session count**
- **Session Batching**: Combines micro-sessions into single context calls
- **Tiered Output**: Quick sessions receive 50-token summaries instead of 600-token full updates

**Effective multiplier: ~0.30× raw time**

| Messages | Sessions (Filtered) | RTX 4070 Optimized | RTX 3060 Optimized | Cloud Time (nano) |
|----------|:--:|:--:|:--:|:--:|
| **50K** | ~230 | **~20 - 25 mins** | **~38 - 45 mins** | **~4 mins** |
| **100K** | ~460 | **~45 - 55 mins** | **~1.2 - 1.4 hrs** | **~8 mins** |
| **500K** | ~2,300 | **~3.5 - 4.5 hrs** | **~6.3 - 7.5 hrs** | **~40 mins** |
| **1M** | ~4,600 | **~7.0 - 8.0 hrs** | **~12.5 - 14.0 hrs** | **~1.5 hrs** |

---

## Cloud Inference Comparison

Using **GPT-4.1-nano** or **Gemini 2.0 Flash** ($0.10 / 1M input tokens, $0.40 / 1M output tokens):

- Input per session: 4,660 tokens × $0.10 / 1M = $0.000466
- Output per session: 600 tokens × $0.40 / 1M = $0.000240
- **Cost per session:** **~$0.0007**

| Messages | Sessions | Cloud Processing Time | Cloud API Cost (GPT-4.1-nano) |
|----------|:--:|:--:|:--:|
| **50K** | 400 | ~4 - 7 mins | **$0.28** |
| **100K** | 800 | ~8 - 15 mins | **$0.56** |
| **500K** | 4,000 | ~40 - 60 mins | **$2.82** |
| **1M** | 8,000 | ~1.5 - 2.2 hrs | **$5.65** |

> [!NOTE]
> For a typical 100K group chat (~4-6 months of heavy conversation), cloud processing takes under **15 minutes** and costs **less than $0.60**.

---

## Stage 5: Comic Generation Time

- **Script Generation (LLM):** 20–50 selected scenes × ~20s/scene = **10–20 minutes**.
- **Image Generation (Diffusion / SDXL / Flux):**
  - RTX 4070: ~12s / panel × 30 panels = **6 minutes** (50 panels = 10 mins).
  - RTX 3060: ~20s / panel × 30 panels = **10 minutes** (50 panels = 17 mins).
- **Composition & Layout:** < 5 seconds.

**Total Comic Generation Time:** **15–30 minutes** on mid-range GPU hardware.

---

## Summary — Pipeline Time Distribution

```
For a 100K message chat on an RTX 4070 with an 8B model:

Parsing & Analytics: ██ < 5 seconds
Segmentation:        ██ < 1 second
LLM Processing:      ██████████████████████████████████ 45 - 55 minutes (Optimized)
Comic Script Gen:    ████ ~15 minutes
Image Generation:    ██████ ~10 minutes
Panel Composition:   ██ seconds

Total Pipeline Time: ~1.2 to 1.5 hours
```

**Key Conclusions:**
1. **100K message chats process in under 1.5 hours total** locally on an RTX 4070.
2. **1M message chats process overnight (~7-8 hours)** locally, or in **~1.5 hours for $5.65** on Cloud.
3. Memory processing remains 90%+ of total runtime, but empirical token density (5.5 tok/msg) makes local processing significantly faster than initially modeled.
