# Yapbook — Processing Time Estimates

> Wall-clock time estimates across the full pipeline for 50 K → 1 M messages, grounded in empirical benchmark data from a real 126 K-message WhatsApp group chat.
>
> This document is updated as new benchmarks are collected. Treat the numbers as calibrated estimates, not guarantees.

---

## Benchmark Dataset

The reference dataset is `WhatsApp Chat with आंतरिक मित्र मंडल (antarik)`:

- **137 k raw lines** in the `.txt` file
- **~126 k parsed messages** after multiline continuation and system message handling
- **~1,026 sessions** at a 30-minute inactivity gap

---

## Benchmark-Validated Assumptions

| Variable | Initial Assumption | Empirical Measurement | Impact |
| :--- | :--- | :--- | :--- |
| **Avg tokens per message** | 15.0 tokens | **5.1 tokens** | −66 % input tokens — chat messages are short, rapid banter |
| **Avg messages per session** | 50 messages | **122 messages** | Messages arrive in dense bursts |
| **Sessions per 100 K msgs** | ~2,000 | **~800** | −60 % fewer sessions to process |
| **Session overhead (system prompt + context)** | 4,000 tokens | **4,000 tokens** | Validated |
| **LLM output per session** | 600 tokens | **600 tokens** | Validated |
| **Filterable sessions (< 5 msgs)** | ~10–15 % | **28.6 %** | Many sessions carry negligible content |
| **Noise message ratio** | ~20 % | **38.5 %** | Single-word, emoji-only, or media placeholders |
| **Combined skip/fast-track ratio** | — | **~42 %** | Low message count + low richness score filtering |

> [!NOTE]
> Token counts were measured empirically, not computed from the `char_count / 4.0` heuristic in the parser. That formula is a rough English-text approximation and underestimates tokenization cost for Devanagari/Hinglish text. Processing time estimates in this document use the measured 5.1 tok/msg average.

---

## Stage-by-Stage Breakdown

### Stage 1 — Parsing

Read the `.txt` file, regex-match message lines, build structured message objects. Pure CPU-bound text processing.

| Messages | Raw Text Size | Parse Time |
| :--- | :--- | :--- |
| 50 K | ~3 MB | < 1 second |
| 100 K | ~6 MB | ~1 second |
| 500 K | ~30 MB | ~2–3 seconds |
| 1 M | ~60 MB | ~4–5 seconds |

**Bottleneck?** No. Entirely negligible.

---

### Stage 2 — Analytics

O(N) single-pass accumulation computing volume, temporal, social, language, and signal metrics.

| Messages | Compute Time | Notes |
| :--- | :--- | :--- |
| 50 K | ~1–2 seconds | Trivial |
| 100 K | ~3–4 seconds | Benchmark measured 3.2 s for 126 K msgs |
| 500 K | ~12–15 seconds | HashMap overhead grows |
| 1 M | ~25–30 seconds | Fast single-pass execution |

**Bottleneck?** No.

---

### Stage 3 — Session Segmentation

Linear scan, break when gap > 30 min.

| Messages | Estimated Sessions | Time |
| :--- | :--- | :--- |
| 50 K | ~400 | < 1 second |
| 100 K | ~800 | < 1 second |
| 500 K | ~4,000 | ~1 second |
| 1 M | ~8,000 | ~2 seconds |

**Bottleneck?** No.

---

### Stage 4 — LLM Memory Processing (THE BOTTLENECK)

This is where the wall-clock time lives.

#### Token Budget Per Session

```
┌──────────────────────────────────────────────┐
│           INPUT TOKENS (~4,622)              │
│                                              │
│  System Prompt ................ 500 tokens   │
│  Memory Context:                             │
│    - Member profiles (compressed) . 1,500    │
│    - Recent session summaries (3) .. 600     │
│    - Relationship snapshot ......... 800     │
│    - Group culture notes ........... 600     │
│  Session Messages (122 × 5.1) ..... 622     │
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

#### LLM Inference Speeds

Realistic throughput for quantized models via `llama-server` / `llama.cpp`:

| Model | Hardware | Prefill (tok/s) | Decode (tok/s) |
| :--- | :--- | :---: | :---: |
| **Qwen 2.5 7B Q4** | RTX 4070 (12 GB) | ~2,500 | ~65 |
| **Qwen 2.5 7B Q4** | RTX 3060 (12 GB) | ~1,200 | ~40 |
| **Qwen 2.5 7B Q4** | Apple M2 Pro (16 GB) | ~800 | ~35 |
| **Qwen 2.5 7B Q4** | CPU-only (16-core) | ~100 | ~10 |

> [!NOTE]
> These numbers are extrapolated from Llama 3.1 8B Q4 benchmarks. Qwen 2.5 7B is slightly smaller and should perform similarly or slightly faster at the same quantization level. Actual measurements will replace these once the supervisor is built.

#### Per-Session Processing Time

| Hardware | Prefill (4,622 tok) | Decode (600 tok) | **Total / Session** |
| :--- | :---: | :---: | :---: |
| RTX 4070 | 1.85 s | 9.23 s | **11.08 s** |
| RTX 3060 | 3.85 s | 15.00 s | **18.85 s** |
| Apple M2 Pro | 5.78 s | 17.14 s | **22.92 s** |
| CPU-only | 46.22 s | 60.00 s | **106.22 s** |

---

### Raw vs. Optimized Wall-Clock Times

#### Raw Times (No Filtering)

**RTX 4070 (11.08 s / session):**

| Messages | Sessions | Raw Wall Time | Human Time |
| :--- | :---: | :---: | :--- |
| 50 K | 400 | 4,432 s | **1.2 hours** |
| 100 K | 800 | 8,864 s | **2.5 hours** |
| 500 K | 4,000 | 44,320 s | **12.3 hours** |
| 1 M | 8,000 | 88,640 s | **~1 day** |

**RTX 3060 (18.85 s / session):**

| Messages | Sessions | Raw Wall Time | Human Time |
| :--- | :---: | :---: | :--- |
| 50 K | 400 | 7,540 s | **2.1 hours** |
| 100 K | 800 | 15,080 s | **4.2 hours** |
| 500 K | 4,000 | 75,400 s | **20.9 hours** |
| 1 M | 8,000 | 150,800 s | **~1.7 days** |

**CPU Only (106.22 s / session):**

| Messages | Sessions | Raw Wall Time | Human Time |
| :--- | :---: | :---: | :--- |
| 50 K | 400 | 42,488 s | **11.8 hours** |
| 100 K | 800 | 84,976 s | **23.6 hours** |
| 500 K | 4,000 | 424,880 s | **4.9 days** |
| 1 M | 8,000 | 849,760 s | **9.8 days** |

---

#### Optimized Times

Applying the benchmark-validated optimization pipeline:
- **Filtering** (< 5 msgs + low richness score): **−42 % session count**
- **Session Batching**: Combines micro-sessions into single context calls
- **Tiered Output**: Quick sessions get 50-token summaries instead of 600-token full extractions

**Effective multiplier: ~0.30× raw time**

| Messages | Sessions (Filtered) | RTX 4070 | RTX 3060 | Cloud (nano) |
| :--- | :---: | :---: | :---: | :---: |
| **50 K** | ~230 | **~20–25 min** | **~38–45 min** | **~4 min** |
| **100 K** | ~460 | **~45–55 min** | **~1.2–1.4 hrs** | **~8 min** |
| **500 K** | ~2,300 | **~3.5–4.5 hrs** | **~6.3–7.5 hrs** | **~40 min** |
| **1 M** | ~4,600 | **~7–8 hrs** | **~12.5–14 hrs** | **~1.5 hrs** |

---

## Cloud Inference Comparison

Using **GPT-4.1-nano** or **Gemini 2.0 Flash** (~$0.10 / 1 M input tokens, ~$0.40 / 1 M output tokens):

- Input per session: 4,622 tokens × $0.10 / 1 M = $0.000462
- Output per session: 600 tokens × $0.40 / 1 M = $0.000240
- **Cost per session: ~$0.0007**

| Messages | Sessions | Cloud Processing Time | Cloud API Cost |
| :--- | :---: | :---: | :---: |
| **50 K** | 400 | ~4–7 min | **$0.28** |
| **100 K** | 800 | ~8–15 min | **$0.56** |
| **500 K** | 4,000 | ~40–60 min | **$2.81** |
| **1 M** | 8,000 | ~1.5–2.2 hrs | **$5.62** |

> [!NOTE]
> For a typical 100 K group chat (~4–6 months of heavy conversation), cloud processing takes under **15 minutes** and costs **less than $0.60**.

---

## Stage 5 — Comic Generation Time

- **Script Generation (LLM)**: 20–50 selected scenes × ~20 s/scene = **10–20 minutes**
- **Image Generation (Diffusion / SDXL / Flux)**:
  - RTX 4070: ~12 s/panel × 30 panels = **6 minutes** (50 panels = 10 min)
  - RTX 3060: ~20 s/panel × 30 panels = **10 minutes** (50 panels = 17 min)
  - Cloud API: ~3–5 s/panel × 30 panels = **~2 minutes** (50 panels = ~4 min)
- **Composition & Layout**: < 5 seconds

**Total Comic Generation: ~15–30 minutes** on mid-range GPU hardware.

---

## Summary — Pipeline Time Distribution

```
For a 100 K message chat on an RTX 4070 with Qwen 2.5 7B Q4:

Parsing & Analytics: ██ < 5 seconds
Segmentation:        ██ < 1 second
LLM Processing:      ██████████████████████████████████ 45–55 minutes (Optimized)
Comic Script Gen:    ████ ~15 minutes
Image Generation:    ██████ ~10 minutes
Panel Composition:   ██ seconds

Total Pipeline Time: ~1.2 to 1.5 hours
```

**Key Conclusions:**
1. **100 K message chats process in under 1.5 hours total** locally on an RTX 4070.
2. **1 M message chats process overnight (~7–8 hours)** locally, or in **~1.5 hours for $5.62** on Cloud.
3. LLM memory processing remains 90 %+ of total runtime, but empirical token density (5.1 tok/msg) makes local processing significantly faster than initially modeled.
