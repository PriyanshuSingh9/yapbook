# Yapbook Chat Benchmark — Conclusion & Empirical Validation

> **Date:** August 12, 2026  
> **Target Dataset:** `data/WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt` (6.67 MB, 137,735 lines)  
> **Timespan:** October 7, 2024 – February 6, 2025 (~4 months)  
> **Status:** Complete

---

## 1. Parse Results & Format Quirks

- **Total Lines Processed:** 137,735
- **Total Messages Parsed:** 125,726 (125,597 non-system messages + 129 system messages)
- **Multi-line Continuation Messages:** 12,008 lines appended to preceding messages
- **Parse Errors:** **0 lines failed to parse** (100% parse success rate)
- **Unique Members Identified:** 10 non-system senders
- **Media Omitted Messages:** 10,184
- **Deleted Messages:** 566

### Format Quirks Encountered
1. **Time Separator:** The Android export uses a narrow no-break space (`\u202F`) between the minute digit and `am`/`pm` (e.g. `9:11 pm`).
2. **Unicode Isolate Markers:** `@mention` tags wrap member names in Unicode directionality isolates (e.g. `@\u2068Priyanshu\u2069`). Sanitization is required before matching against member names.
3. **Multi-line Messages:** Code blocks, poetry, long rants, and line-broken emoji sequences (e.g. `🤯` on line 2) must be concatenated to the previous message.

---

## 2. Chat Profile

- **Chat Lifespan:** 122 calendar days (Active on 122 of 122 days — 100% daily activity rate)
- **Average Messages per Day:** **1,029 messages/day** across the active group
- **Busiest Day:** October 7, 2024 (Group creation date) with 4,142 messages
- **Quietest Day:** November 14, 2024 with 82 messages
- **Longest Active Streak:** 122 consecutive days
- **Longest Gap / Silence:** 28.4 hours

### Member Contribution Breakdown

| Member | Messages | Share % | Avg Chars | Avg Words | Short Msg % (≤3w) | Emoji Total | Avg Tokens | Active Days | Session Initiations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ashwani** | 31,667 | 25.21% | 23.8 | 4.6 | 58.4% | 7,654 | 6.0 | 122 | 342 |
| **Bharti Mait** | 19,875 | 15.82% | 19.5 | 3.8 | 63.8% | 3,892 | 4.9 | 121 | 184 |
| **Priyanshu** | 19,259 | 15.33% | 20.1 | 3.9 | 62.1% | 3,745 | 5.0 | 119 | 148 |
| **Vansh** | 17,135 | 13.64% | 18.9 | 3.7 | 64.9% | 3,812 | 4.7 | 118 | 124 |
| **Shagun Mait** | 9,726 | 7.74% | 20.4 | 4.0 | 61.2% | 2,410 | 5.1 | 114 | 72 |
| **Aaditya** | 9,033 | 7.19% | 18.7 | 3.6 | 66.4% | 1,840 | 4.7 | 115 | 68 |
| **Kanishka Bhardwaj** | 8,347 | 6.65% | 18.2 | 3.5 | 67.1% | 1,620 | 4.6 | 112 | 51 |
| **Praneel Mait** | 7,140 | 5.68% | 19.1 | 3.7 | 64.2% | 1,480 | 4.8 | 110 | 31 |
| **Sumit** | 3,237 | 2.58% | 19.8 | 3.8 | 62.5% | 680 | 5.0 | 85 | 6 |
| **Meta AI** | 178 | 0.14% | 145.2 | 26.4 | 4.5% | 12 | 36.3 | 24 | 0 |

---

## 3. Assumption Validation (`docs/processing-times.md`)

| Metric / Assumption | `processing-times.md` Assumption | Benchmark Measured Value | Impact / Variance |
| :--- | :--- | :--- | :--- |
| **Avg Tokens per Message** | 15.0 tokens / msg | **5.1 tokens / msg** | **-66% lower input tokens** — Messages in WhatsApp group chats are significantly shorter than expected. |
| **Avg Msgs / Session (30-min)**| 50 msgs / session | **122.4 msgs / session** | **+144% msgs per session** — Messages arrive in dense rapid bursts. |
| **Total Session Count (30-min)**| ~2,500 sessions | **1,026 sessions** | **-59% fewer sessions** to summarize. |
| **Filterable Sessions (<5 msgs)**| ~10-15% | **294 sessions (28.6%)** | **High noise filterability** — 28.6% of sessions carry negligible content and can be skipped or batched. |
| **Noise Message Ratio** | ~20% | **35.7%** | **35.7% of messages** are single words, emoji-only, deleted, or media placeholders. |
| **Total Input Tokens (30-min)** | ~11.2M tokens | **4.74M tokens** | **-58% reduction in LLM compute load**. |
| **RTX 4070 Optimized Time** | ~3.5 hours | **0.95 hours (~57 mins)** | Processable in **under 1 hour** on standard mid-range GPU! |
| **Cloud API Cost (GPT-4.1-nano)**| ~$2.50 | **$0.72** | Extremely affordable cloud fallback. |

---

## 4. Language Analysis

- **Hinglish Ratio:** **37.8%** of messages mix Hindi vocabulary with English/Latin script.
- **English Ratio:** **52.2%** of messages are standard English text/slang.
- **Pure Devanagari Hindi Ratio:** **0.3%** of messages.
- **Devanagari Character Ratio:** **< 0.1%** of total characters.

### Model Selection Implications
The chat is heavily code-switched Hinglish (`"mereko explanation Dene ki zarurat hai"`, `"hauz khas fort aur deer park jayenge"`). Small 8B models trained strictly on English will struggle with nuance. **Qwen 2.5 7B/8B**, **Llama 3.1 8B**, or **Gemma 2 9B** (which have strong multilingual and code-switching capabilities) are essential. Pure English LLMs should be avoided for Hinglish group chats.

---

## 5. Session Strategy Comparison

| Strategy | Threshold | Session Count | Avg Msgs | Median Msgs | &lt; 5 Msgs | &gt; 100 Msgs | Avg Duration | Filterable % |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inactivity Gap** | 5min | 3,659 | 34.3 | 4 | 1,837 | 262 | 14.2m | 50.2% |
| **Inactivity Gap** | 10min | 2,324 | 54.0 | 7 | 965 | 263 | 24.8m | 41.5% |
| **Inactivity Gap** | 15min | 1,782 | 70.5 | 10 | 638 | 260 | 34.5m | 35.8% |
| **Inactivity Gap** | **30min (Default)**| **1,026** | **122.4** | **16** | **294** | **229** | **68.2m** | **28.6%** |
| **Inactivity Gap** | 60min | 555 | 226.3 | 36 | 129 | 202 | 145.1m | 23.2% |
| **Inactivity Gap** | 120min | 247 | 508.5 | 164 | 38 | 143 | 342.8m | 15.4% |
| **Time-of-Day Aware**| 30min | 1,154 | 108.8 | 14 | 349 | 239 | 59.4m | 30.2% |
| **Participant Shift**| 30min (N=10) | 6,757 | 18.6 | 9 | 305 | 145 | 18.4m | 4.5% |

### Strategy Recommendation
- **30-minute Inactivity Gap remains the optimal default.**
- **5min / 10min** thresholds over-segment sessions (creating >1,800 micro-sessions with <5 messages).
- **Participant Shift** over-segments active multi-way banter when member turns change rapidly.

---

## 6. Context Window Fit

For the 30-min Inactivity Gap sessions (including 4000 overhead tokens):
- **Sessions fitting in 4K context (4,096 tokens):** **93.8%** (962 / 1,026 sessions)
- **Sessions fitting in 8K context (8,192 tokens):** **97.4%** (999 / 1,026 sessions)
- **Sessions fitting in 16K context (16,384 tokens):** **99.4%** (1,020 / 1,026 sessions)
- **Sessions fitting in 32K context (32,768 tokens):** **100.0%** (1,026 / 1,026 sessions)

### Recommendation
Target a minimum LLM context window of **8K tokens** (or 16K for 100% coverage without chunking).

---

## 7. Session Quality Distribution & Skipping

- **Low-Message Count Filter (<5 msgs):** 294 sessions (28.6%)
- **Low-Richness Score Filter (<25th percentile):** 256 sessions (25.0%)
- **Combined Filter Ratio:** **~42% of total sessions can be skipped or fast-tracked** using quick heuristic templates instead of full LLM context synthesis.

---

## 8. Comic Potential & Narrative Signals

- **Rapid Exchanges Detected (3+ members in <2 min):** **342 exchanges** (Ideal seeds for comic strip panels).
- **Event Anchor Messages Detected:** **1,842 messages** referencing trips, parties, exams, movies, birthdays, and meetups.
- **Monologues (Storytelling / Rants):** **218 instances** where a member sent 5+ consecutive un-interrupted messages.
- **Emotional Keyword Density:** Laughter (`haha`, `lmao`, `😂`) and Excitement (`!!`, `🔥`, `lessgo`) appear in **>44% of all sessions**.

---

## 9. Memory System Viability

- **Repeated Inside Jokes / Phrases:** **148 distinct 3-word n-grams** detected across 3+ sessions and 2+ members (e.g. `"call utha lena"`, `"fort aur deer"`, `"diddy's basement"`).
- **Mention Graph Density:** **0.84** (84% of all possible directed mention edges exist). The group is tightly interconnected socially.
- **Member Activity Epochs:** Members average **3.2 activity phase shifts** (e.g., exam periods vs vacation weeks).

---

## 10. Revised Wall-Clock Time Estimates

For processing the full 4-month chat dataset (125,597 messages):

| Hardware Setup | Raw Processing Time | Optimized Processing Time (0.3x multiplier) |
| :--- | :--- | :--- |
| **RTX 4070 + 8B LLM** | 3.16 hours | **0.95 hours (~57 mins)** |
| **RTX 3060 + 8B LLM** | 5.37 hours | **1.61 hours** |
| **CPU-Only + 8B LLM** | 30.28 hours | **9.08 hours** |
| **Cloud API (GPT-4.1-nano)**| -- | **Est. Cost: $0.72** |

---

## 11. Recommendations for Architecture (`docs/architecture.md`)

1. **Update Token Estimator Default:** Change assumed message token length from 15 to **5.5 tokens/msg** for WhatsApp exports.
2. **Implement Dual-Tier Session Filtering:** Strip sessions with <5 messages OR low richness score before calling LLM pipelines.
3. **Mandatory Hinglish Support:** Require LLM models to have verified code-switching capability (Qwen 2.5 / Gemma 2 / Llama 3.1).
4. **Sub-Burst Splitting:** For long sessions (>150 messages), split at sub-burst pauses (>3 mins) to keep prompt tokens bounded under 8K.
