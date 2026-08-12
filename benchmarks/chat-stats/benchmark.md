# Yapbook Chat Benchmark — Specification

> **Goal:** Build a TypeScript-based WhatsApp chat analyzer with a local web interface to extract real metrics from an actual group chat. These metrics validate the assumptions in [`docs/processing-times.md`](../../docs/processing-times.md) and inform architectural decisions in [`docs/architecture.md`](../../docs/architecture.md).

---

## 1. Overview

### What We're Building

A TypeScript + Node.js tool that:

1. Parses a WhatsApp `.txt` export into structured messages
2. Computes analytics metrics (member stats, temporal patterns, content analysis)
3. Runs session segmentation experiments with multiple strategies and thresholds
4. Serves a local web interface to visualize all results interactively
5. Exports a JSON report of all computed metrics for documentation in `conclusion.md`

### Test Data

- **File:** `data/WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt`
- **Format:** Android export — `DD/MM/YY, H:MM am/pm - Sender: Message`
- **Size:** ~7MB, ~137K lines, ~126K messages
- **Timespan:** October 2024 – February 2025 (~4 months)
- **Language:** Primarily Hinglish (Hindi-English code-switching)
- **Contains:** Multi-line messages, `<Media omitted>` markers, system messages, emoji, mentions (`@⁨Name⁩`)

### Reference Repositories

Clone these into `benchmarks/lang_perf/references/` for parsing and analysis ideas:

```bash
git clone https://github.com/irfanchahyadi/Whatsapp-Chat-Analyzer.git references/irfan-analyzer
git clone https://github.com/koftezz/whatsapp-chat-analyzer.git references/koftezz-analyzer
```

Study their parsing regex patterns and analytics approaches. **Do not use them as runtime dependencies** — they're Python. Extract ideas and reimplement in TypeScript.

---

## 2. Project Setup

### Directory Structure

```
benchmarks/lang_perf/
├── benchmark.md              # Benchmark specification
├── conclusion.md             # Empirical findings & validation
├── report.json               # Generated report JSON
├── data/                     # Chat export files
├── references/               # Cloned reference repos
│   ├── irfan-analyzer/
│   └── koftezz-analyzer/
└── code/                     # Implementation codebase
    ├── src/
    │   ├── parser.ts
    │   ├── analytics.ts
    │   ├── sessions.ts
    │   ├── types.ts
    │   ├── report.ts
    │   └── server.ts
    ├── public/
    │   ├── index.html
    │   ├── styles.css
    │   └── app.js
    ├── package.json
    └── tsconfig.json
```

### Tech Stack

- **Runtime:** Node.js with TypeScript (use `tsx` for running without build step)
- **Web Server:** Express or Hono (lightweight, no framework overhead)
- **Charts (client-side):** Chart.js or Plotly.js loaded via CDN
- **No build tools for the frontend** — plain HTML/CSS/JS served statically, charts via CDN

### Scripts

```json
{
  "scripts": {
    "dev": "tsx src/server.ts",
    "analyze": "tsx src/report.ts"
  }
}
```

- `npm run dev` — starts the web server with the UI
- `npm run analyze` — runs analysis and outputs JSON report to stdout

---

## 3. Parser (`src/parser.ts`)

### Message Format

The Android WhatsApp export format for this chat is:

```
DD/MM/YY, H:MM am/pm - Sender: Message content
```

Examples from the actual data:

```
07/10/24, 9:11 pm - Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them. *Learn more*
07/10/24, 9:11 pm - Ashwani created group "Section K (close one) 😍"
07/10/24, 9:11 pm - Ashwani: I don't think mereko explanation Dene ki zarurat hai for this group 😀.
07/10/24, 9:13 pm - Aaditya: itna kharcha
🤯
```

### Parsing Rules

1. **Message line regex:** A line starting with `DD/MM/YY, H:MM am/pm - ` is a new message. Everything else is a continuation of the previous message.

2. **System messages:** Lines matching the timestamp pattern but with no `:` after the sender name are system messages. Examples:
   - `Ashwani created group "..."`
   - `Ashwani added you`
   - `Messages and calls are end-to-end encrypted...`
   - `You were added`
   - `... changed the group description`
   - `... changed this group's icon`
   - `... changed the subject from ... to ...`

3. **Multi-line messages:** If a line does NOT match the timestamp regex, append it to the previous message's content (with a `\n` separator).

4. **Media omitted:** Messages containing exactly `<Media omitted>` as content should be typed as `media_omitted`.

5. **Deleted messages:** Messages containing `This message was deleted` or `You deleted this message` should be typed as `deleted`.

6. **Links:** Messages containing URLs (regex: `https?://\S+`) should be typed as `link` (but still keep the full content).

7. **Sender extraction:** For non-system messages, the sender is the text between `- ` and `: `. The exporter's own messages — if they have no sender (just `- Message`) — should be identified. In this export, the user's messages appear under their contact name, so this may not apply. Detect and handle either case.

### Output Types (`src/types.ts`)

```typescript
interface Message {
  id: number;                    // Sequential index (0-based)
  timestamp: Date;               // Parsed datetime
  sender: string;                // Sender name (empty string for system)
  content: string;               // Full message text (including continuation lines)
  type: 'text' | 'system' | 'deleted' | 'link' | 'media_omitted';
  charCount: number;             // Character count of content
  wordCount: number;             // Word count of content
  estimatedTokens: number;       // Estimated LLM tokens (charCount / 4)
  emojiCount: number;            // Number of emoji in message
  shape: 'emoji_only' | 'single_word' | 'short' | 'medium' | 'long' | 'media_placeholder';
  // Shape categories: emoji_only (only emoji/whitespace), single_word (1 word),
  // short (2-5 words), medium (6-20 words), long (20+ words),
  // media_placeholder (media_omitted/deleted types)
  language: 'en' | 'hi' | 'hinglish' | 'other';
  // Language detection heuristic: 'hi' if >50% Devanagari chars,
  // 'en' if >90% Latin chars, 'hinglish' if mix, 'other' otherwise
  hasUrl: boolean;
  hasMention: boolean;           // Contains @⁨Name⁩ pattern
  mentionedNames: string[];      // Extracted mention names
}

interface ParseResult {
  messages: Message[];
  members: string[];             // Unique non-system senders
  parseErrors: number;           // Lines that couldn't be parsed
  timespan: { start: Date; end: Date };
  totalLines: number;
}
```

### Validation

After parsing, log:
- Total messages parsed
- Total lines in file
- Lines that are continuations (multi-line messages)
- Parse errors (lines that don't fit any pattern)
- Number of unique senders
- Number of system messages
- Number of `<Media omitted>` messages
- Date range of the chat

---

## 4. Analytics (`src/analytics.ts`)

Implement each metric calculator as an independent function that takes `Message[]` and `string[]` (members) as input. This mirrors the architecture doc's pipeline-of-calculators design.

### 4.1 Volume Metrics

| Metric | Description |
|--------|-------------|
| `totalMessages` | Total message count (excluding system) |
| `totalSystemMessages` | System message count |
| `messagesPerMember` | `Map<sender, count>` — sorted descending |
| `mediaOmittedCount` | How many `<Media omitted>` messages |
| `deletedCount` | How many deleted messages |
| `linkCount` | How many messages contain links |
| `messagesPerDay` | `Map<YYYY-MM-DD, count>` |
| `messagesPerWeek` | `Map<YYYY-WW, count>` |
| `messagesPerMonth` | `Map<YYYY-MM, count>` |

### 4.2 Temporal Metrics

| Metric | Description |
|--------|-------------|
| `hourlyDistribution` | `number[24]` — messages per hour of day (0-23) |
| `dayOfWeekDistribution` | `number[7]` — messages per day of week (Mon-Sun) |
| `heatmap` | `number[7][24]` — day-of-week × hour-of-day matrix |
| `busiestDay` | Date with most messages |
| `quietestDay` | Date with fewest messages (excluding days with 0) |
| `longestStreak` | Longest consecutive days with at least 1 message |
| `longestSilence` | Longest gap (in hours) between any two consecutive messages |
| `averageMessagesPerDay` | Mean messages per active day |
| `activeDays` | Number of days with at least 1 message |

### 4.3 Per-Member Behavioral Metrics

For each member, compute:

| Metric | Description |
|--------|-------------|
| `totalMessages` | Their message count |
| `percentage` | Their share of total messages |
| `avgMessageLength` | Average character count per message |
| `avgWordCount` | Average words per message |
| `medianMessageLength` | Median character count |
| `longestMessage` | Character count of their longest message |
| `shortMessageRate` | % of messages with ≤ 3 words |
| `emojiCount` | Total emoji used (use a regex for Unicode emoji ranges) |
| `mostUsedEmojis` | Top 10 emoji by frequency |
| `topWords` | Top 20 most-used words (exclude stop words — provide a basic English + Hindi stop word list) |
| `firstMessageDate` | When they first messaged |
| `lastMessageDate` | When they last messaged |
| `activeDays` | Number of distinct days they sent a message |
| `hourlyPattern` | `number[24]` — their personal hour-of-day distribution |
| `initiationCount` | Number of times they sent the first message in a session (use 30-min gap sessions) |

### 4.4 Social / Interaction Metrics

| Metric | Description |
|--------|-------------|
| `replyMatrix` | `Map<sender, Map<repliedTo, count>>` — When member A sends a message right after member B (within 5 minutes, no other messages between), count it as A replying to B. This is a heuristic since WhatsApp text exports don't include reply metadata. |
| `mentionMatrix` | `Map<sender, Map<mentioned, count>>` — Count `@⁨Name⁩` mentions in message content |
| `conversationStarters` | Who sends the first message of each session (30-min gap) most often |
| `ghosters` | Members sorted by (messages received via reply heuristic - messages sent), higher = more ghosting |

### 4.5 Content Metrics

| Metric | Description |
|--------|-------------|
| `globalTopWords` | Top 50 words across all messages (excluding stop words) |
| `globalTopEmojis` | Top 20 emoji across all messages |
| `avgGroupMessageLength` | Average message length across all members |
| `messagesByType` | Count of each message type |

### 4.6 Milestone Metrics

| Metric | Description |
|--------|-------------|
| `milestones` | Messages at 1K, 5K, 10K, 25K, 50K, 100K marks — who sent each milestone message, when, and what it said |
| `firstMessage` | First non-system message details |
| `groupCreationDate` | From the system message |

### 4.7 Token & Message Shape Metrics

These directly validate the assumptions in `docs/processing-times.md` and inform LLM context window budgeting.

| Metric | Description |
|--------|-------------|
| `avgTokensPerMessage` | Mean of `estimatedTokens` across all non-system messages |
| `medianTokensPerMessage` | Median of `estimatedTokens` |
| `p95TokensPerMessage` | 95th percentile — catches long messages that inflate session token counts |
| `avgCharsPerMessage` | Mean character count |
| `avgWordsPerMessage` | Mean word count |
| `tokenDistribution` | Histogram buckets: `1-5`, `6-10`, `11-20`, `21-50`, `51-100`, `100+` tokens |
| `shapeDistribution` | Count of each `shape` category across all messages |
| `noiseMessageRatio` | % of messages that are `emoji_only`, `single_word`, `media_omitted`, or `deleted` — these carry minimal semantic content for LLM processing |
| `contentMessageRatio` | 1 - noiseMessageRatio — the % of messages that actually carry analyzable content |
| `avgTokensPerMember` | `Map<sender, avgTokens>` — some members write long messages, others don't. Affects per-session token variance |

### 4.8 Language Metrics

Critical for LLM model selection — many smaller models handle multilingual/Hinglish poorly.

| Metric | Description |
|--------|-------------|
| `languageDistribution` | Count and % of messages per `language` category (`en`, `hi`, `hinglish`, `other`) |
| `languageByMember` | `Map<sender, Map<language, count>>` — do different members use different languages? |
| `devanagariCharRatio` | Global ratio of Devanagari characters to total alphabetic characters |
| `codeSwwitchingRate` | % of messages classified as `hinglish` — messages that mix scripts within the same message |

### 4.9 LLM Pipeline Readiness Metrics

Metrics that directly inform LLM pipeline engineering decisions.

| Metric | Description |
|--------|-------------|
| `contextWindowSimulation` | For each session (at 30-min threshold), compute estimated total input tokens: `4000 (overhead) + (session_messages × avg_tokens_per_msg)`. Return: distribution histogram, % of sessions exceeding 4K/8K/16K/32K tokens, mean, median, p95, max |
| `sessionContentRichness` | For each session (30-min), compute a richness score: `(unique_participants × avg_msg_word_count × message_count) / duration_minutes`. Return: distribution, mean, median. Sessions below the 25th percentile are "low richness" — candidates for skip/quick-tier processing |
| `noiseRatioPerSession` | For each session (30-min), what % of messages are noise (emoji_only, single_word, media_omitted, deleted)? Return: mean, median, distribution. High-noise sessions can have noise stripped before LLM processing |
| `consecutiveSessionParticipantOverlap` | For each pair of adjacent sessions (30-min), compute Jaccard similarity of participant sets. Return: mean, median, distribution. High overlap (>0.8) means simpler memory retrieval; low overlap means we need smarter profile loading per session |
| `sessionTokenEstimates` | For each session (30-min), compute: input tokens (overhead + messages), output tokens (600 fixed), prefill time, decode time for each hardware config. Return: per-session time distribution, total time |

### 4.10 Comic-Worthiness Signal Metrics

Metrics that help identify which moments in the chat are good candidates for comic panels.

| Metric | Description |
|--------|-------------|
| `rapidExchanges` | Find sequences where 3+ unique senders exchange 5+ messages within a 2-minute window. Record: count of such exchanges, their timestamps, participants, and message count. These back-and-forth moments are natural comic panel candidates |
| `emotionalKeywords` | Count messages containing strong emotion markers. Categories: **laughter** (`haha`, `hehe`, `lmao`, `lmfao`, `rofl`, `😂`, `🤣`, `💀`), **excitement** (`!!`, `🔥`, `lessgo`, `letsgoo`, `yessss`, `🎉`), **conflict/frustration** (`wtf`, `stfu`, `chup`, `pagal`, `🤬`), **affection** (`❤️`, `🥺`, `love`, `miss`, `pyaar`). Return: per-category counts, per-session density, per-member distribution |
| `eventMessages` | Messages likely referencing real-life events. Detect by keywords: `trip`, `party`, `exam`, `birthday`, `plan`, `tomorrow`, `weekend`, `movie`, `dinner`, `match`, `college`, `fest`, `meetup`. Return: count, timestamps, which members mentioned them. These are narrative anchors for the comic |
| `monologues` | Sequences where one person sends 5+ consecutive messages with no one else replying (or only system messages between). Record: count, sender, message count, duration. These could be storytelling moments or rants — both comic-worthy |
| `questionBursts` | Messages ending with `?` that get 3+ responses within 5 minutes. These are group discussion triggers — good comic panel seeds |

### 4.11 Memory System Signal Metrics

Metrics that inform the design of the memory system (profiles, relationships, culture detection).

| Metric | Description |
|--------|-------------|
| `repeatedPhrases` | Find 3+ word n-grams (case-insensitive) that appear in 3+ different sessions (30-min) by 2+ different members. These are candidate inside jokes or shared references. Return: phrases sorted by frequency, with session count and member count. Validates whether the Culture Detector prompt is needed |
| `memberActivityEpochs` | For each member, compute messages-per-week over the chat's lifetime. Detect "phase transitions" — weeks where a member's activity changes by >50% compared to the 4-week rolling average. Return: per-member epoch count, transition timestamps. This tells us how often profile evolution notes need updating |
| `mentionGraphDensity` | Build the `@⁨Name⁩` directed mention graph. Compute: edge count, density (edges / possible edges), in-degree and out-degree per member, clustering coefficient if possible. Is the graph dense (everyone mentions everyone) or clustered (subgroups)? Informs relationship map complexity |
| `burstPatterns` | Within each session, compute inter-message time distribution. Identify sub-bursts (sequences of messages with <30s gaps separated by >3min pauses). Return: avg sub-bursts per session, avg sub-burst length. Informs whether we need sub-session splitting for very long sessions |

---

## 5. Session Segmentation Experiments (`src/sessions.ts`)

This is the **most important section for validating architecture assumptions**. We need to understand how different segmentation strategies produce different session counts and characteristics for this real chat.

### 5.1 Strategy: Inactivity Gap

The simplest strategy. Break into a new session whenever the gap between consecutive messages exceeds a threshold.

**Run with these thresholds:** 5 min, 10 min, 15 min, 30 min, 60 min, 120 min, 240 min, 480 min

For each threshold, record:

```typescript
interface SessionExperimentResult {
  strategy: string;
  threshold: string;              // e.g. "30min"
  sessionCount: number;
  avgMessagesPerSession: number;
  medianMessagesPerSession: number;
  minMessagesPerSession: number;
  maxMessagesPerSession: number;
  stdDevMessagesPerSession: number;
  sessionsWithLessThan5Msgs: number;    // Filterable sessions
  sessionsWithLessThan10Msgs: number;
  sessionsWithMoreThan100Msgs: number;
  sessionsWithMoreThan200Msgs: number;
  avgSessionDurationMinutes: number;
  medianSessionDurationMinutes: number;
  avgParticipantsPerSession: number;
  singleParticipantSessions: number;    // Sessions where only 1 person talked
  // Distribution buckets for messages per session
  distribution: {
    '1-5': number;
    '6-15': number;
    '16-50': number;
    '51-100': number;
    '101-200': number;
    '201-500': number;
    '500+': number;
  };
}
```

### 5.2 Strategy: Time-of-Day Aware

Same as inactivity gap, but with an additional rule: if a message arrives during "sleep hours" (midnight–6AM) after a gap of at least 15 minutes, always break.

**Run with base thresholds:** 30 min, 60 min (combined with the sleep-hour rule)

Record the same `SessionExperimentResult` shape.

### 5.3 Strategy: Participant Shift

Layer on top of inactivity gap: within a session, if the set of active participants in the last N messages changes by more than 50% compared to the next N messages, break the session.

**Run with:** 30-min inactivity gap + participant window of 10 messages

Record the same `SessionExperimentResult` shape.

### 5.4 Combined Analysis

After running all experiments, compute a **comparison table** with one row per experiment.

Also compute for the **recommended strategy** (30-min inactivity gap, which is our architecture doc default):

- **Token estimates** using the formula from `docs/processing-times.md`:
  - Input tokens per session: `4000 (overhead) + (avgMessagesPerSession × 15)`
  - Output tokens per session: `600`
  - Total input tokens: `sessionCount × inputTokensPerSession`
  - Total output tokens: `sessionCount × 600`
- **Estimated wall-clock time** for:
  - RTX 4070 + 8B model (prefill: 2500 tok/s, decode: 65 tok/s)
  - RTX 3060 + 8B model (prefill: 1200 tok/s, decode: 40 tok/s)
  - CPU-only + 8B model (prefill: 100 tok/s, decode: 10 tok/s)
- **Estimated cloud cost** at $0.10/1M input + $0.40/1M output (GPT-4.1-nano pricing)
- **Filterable session count** — how many sessions remain after filtering out sessions with < 5 messages
- **Estimated optimized time** — apply the 0.3× multiplier from the processing times doc

---

## 6. Web Interface

### Server (`src/server.ts`)

- Serve static files from `public/`
- API endpoints:
  - `GET /api/parse-info` — parse validation stats
  - `GET /api/analytics` — all computed analytics (volume, temporal, per-member, social, content, milestones, token/shape, language)
  - `GET /api/pipeline` — LLM pipeline readiness metrics (context window simulation, session richness, noise ratios, participant overlap)
  - `GET /api/comic-signals` — comic-worthiness signal metrics (rapid exchanges, emotional keywords, event messages, monologues)
  - `GET /api/memory-signals` — memory system signal metrics (repeated phrases, activity epochs, mention graph, burst patterns)
  - `GET /api/sessions` — all session experiment results
  - `GET /api/sessions/:strategy/:threshold` — detailed session list for a specific experiment (session start/end times, message counts, participants)

Run parsing and analytics on server startup, cache results in memory. This chat is small enough (~7MB) to hold entirely in memory.

### Web UI (`public/`)

A single-page application with tabbed navigation. Use Chart.js or Plotly.js via CDN for charts. The interface should be clean, functional, and readable — this is a data exploration tool, not a production app, but it should still look good.

#### Tab 1: Overview

- **Summary cards:** Total messages, unique members, active days, chat lifespan, messages per day average
- **Messages over time:** Area chart of messages per day across the full timespan
- **Member breakdown:** Horizontal bar chart of messages per member, sorted descending
- **Message type breakdown:** Pie/donut chart (text vs media_omitted vs deleted vs link vs system)

#### Tab 2: Temporal Patterns

- **Hour-of-day histogram:** Bar chart of the `hourlyDistribution`
- **Day-of-week bar chart:** `dayOfWeekDistribution`
- **Heatmap:** Day-of-week × hour-of-day grid, color-intensity-coded
- **Notable stats:** Busiest day, quietest day, longest streak, longest silence

#### Tab 3: Members

- **Member selector:** Dropdown or clickable list to select a member
- **Selected member's stats:** All per-member metrics displayed
- **Member comparison table:** All members side-by-side in a sortable table
- **Top words per member:** Show top 10 words for the selected member
- **Top emoji per member:** Show top 5 emoji for the selected member
- **Activity pattern:** Per-member hourly histogram overlaid or selectable

#### Tab 4: Interactions

- **Reply heatmap:** Matrix visualization of the reply heuristic data
- **Mention network:** If mentions exist, show a simple directed graph or matrix
- **Conversation starters:** Bar chart of who starts sessions most often
- **Milestones timeline:** List of milestone messages with who sent them

#### Tab 5: Session Experiments (most important tab)

- **Comparison table:** All session experiments in a sortable table with all metrics from `SessionExperimentResult`
- **Session count vs threshold chart:** Line chart showing how session count changes as inactivity threshold increases (for the inactivity gap strategy)
- **Distribution chart:** For a selectable experiment, show the messages-per-session distribution as a bar chart
- **Avg messages per session vs threshold:** Line chart
- **Token & time estimates:** For the selected experiment, show estimated processing time for each hardware config and cloud cost
- **Recommendation highlight:** Visually highlight the 30-min inactivity gap row as the "architecture default" and show whether the real data supports or challenges the assumptions in `docs/processing-times.md`

#### Tab 6: LLM Pipeline Readiness

- **Token estimation validation:** Side-by-side comparison: assumed 15 tok/msg vs actual measured avg tokens/msg. Show the impact on total processing time
- **Message shape breakdown:** Pie chart of shape distribution (emoji_only, single_word, short, medium, long, media_placeholder)
- **Noise ratio:** Bar showing content vs noise messages, with breakdown of noise types
- **Language distribution:** Pie chart of language categories. Flag if >20% is non-English (affects model selection)
- **Context window simulation:** Histogram of estimated input tokens per session. Draw vertical lines at 4K, 8K, 16K, 32K context limits. Show what % of sessions fit each window
- **Session richness distribution:** Histogram with the 25th percentile line. Sessions below = skippable
- **Participant overlap heatmap:** Distribution of Jaccard similarity between consecutive sessions
- **Noise per session:** Distribution of noise message ratio across sessions

#### Tab 7: Comic & Memory Signals

- **Rapid exchanges:** Timeline scatter plot of detected rapid exchanges, sized by message count
- **Emotional density per session:** Heatmap or line chart showing emotional keyword density across sessions over time
- **Event markers:** Timeline of detected event-related messages
- **Monologues:** List of top monologues by length, with sender and preview
- **Inside jokes / repeated phrases:** Table of detected repeated phrases, sorted by frequency, with session span and member count
- **Member activity epochs:** Per-member sparklines showing messages-per-week over time, with phase transition markers
- **Mention graph:** Simple directed graph visualization (or adjacency matrix) of the @mention network

---

## 7. Report Generation (`src/report.ts`)

Run all analytics and session experiments, then output a structured JSON report to stdout. This report should contain:

```typescript
interface BenchmarkReport {
  metadata: {
    chatFile: string;
    fileSize: string;
    totalLines: number;
    parsedAt: string;              // ISO timestamp
  };
  parseStats: {
    totalMessages: number;
    totalSystemMessages: number;
    uniqueMembers: number;
    parseErrors: number;
    multiLineMessages: number;
    timespan: { start: string; end: string };
    durationDays: number;
  };
  volumeMetrics: { /* all volume metrics */ };
  temporalMetrics: { /* all temporal metrics */ };
  memberMetrics: { /* per-member metrics, keyed by sender name */ };
  socialMetrics: { /* reply matrix, mentions, starters */ };
  contentMetrics: { /* global words, emoji, etc */ };
  milestones: { /* milestone messages */ };
  tokenAndShapeMetrics: {
    avgTokensPerMessage: number;
    medianTokensPerMessage: number;
    p95TokensPerMessage: number;
    avgCharsPerMessage: number;
    avgWordsPerMessage: number;
    tokenDistribution: Record<string, number>;
    shapeDistribution: Record<string, number>;
    noiseMessageRatio: number;
    contentMessageRatio: number;
  };
  languageMetrics: {
    languageDistribution: Record<string, number>;
    devanagariCharRatio: number;
    codeSwitchingRate: number;
  };
  pipelineReadiness: {
    contextWindowSimulation: {
      mean: number;
      median: number;
      p95: number;
      max: number;
      pctExceeding4K: number;
      pctExceeding8K: number;
      pctExceeding16K: number;
      pctExceeding32K: number;
    };
    sessionRichness: { mean: number; median: number; p25: number };
    avgNoiseRatioPerSession: number;
    avgParticipantOverlap: number;
  };
  comicSignals: {
    rapidExchangeCount: number;
    emotionalKeywordCounts: Record<string, number>;
    eventMessageCount: number;
    monologueCount: number;
    questionBurstCount: number;
  };
  memorySignals: {
    repeatedPhraseCount: number;
    topRepeatedPhrases: { phrase: string; count: number; sessions: number; members: number }[];
    avgEpochsPerMember: number;
    mentionGraphDensity: number;
    avgSubBurstsPerSession: number;
  };
  sessionExperiments: SessionExperimentResult[];
  processingTimeEstimates: {
    strategy: string;
    threshold: string;
    realAvgTokensPerMessage: number;
    estimates: {
      hardware: string;
      rawTimeHours: number;
      optimizedTimeHours: number;
    }[];
    cloudCost: number;
  };
}
```

Also write this report to `benchmarks/lang_perf/report.json`.

---

## 8. Conclusion Document

After running the benchmark and reviewing results in the web UI, fill `conclusion.md` with:

1. **Parse Results** — How many messages were actually parsed, any parse errors, what format quirks were encountered
2. **Chat Profile** — Real stats: members, messages, timespan, messages/day, activity patterns
3. **Assumption Validation** — Compare real data against the assumptions in `docs/processing-times.md`:
   - Real avg tokens per message vs assumed 15 tokens — what's the actual number?
   - Real avg messages per session at 30-min threshold vs assumed 50
   - Real session count vs estimated session count
   - Real % of filterable sessions (< 5 messages)
   - Real noise message ratio — what % of messages can be stripped before LLM processing?
4. **Language Analysis** — What's the Hinglish ratio? Does this chat require a multilingual-capable model, or would an English-primary model suffice? Implications for model selection
5. **Session Strategy Comparison** — Which thresholds produce reasonable session sizes? Is 30 min the right default or should we adjust?
6. **Context Window Fit** — What % of sessions fit in 4K/8K/16K/32K context windows? What's the minimum context window we should target?
7. **Session Quality Distribution** — What % of sessions are low-richness (skippable)? What's the realistic filterable ratio when combining low-message-count + low-richness + high-noise filters?
8. **Comic Potential** — How many rapid exchanges, emotional peaks, event messages, and monologues were detected? Is there enough "interesting" material for comic generation?
9. **Memory System Viability** — Were inside jokes / repeated phrases detected? How many member activity phase transitions exist? Is the mention graph dense or sparse? What does this mean for the Culture Detector and Profile Updater prompts?
10. **Revised Time Estimates** — Using real session counts, real tokens/message, real noise ratios, and real filterability, what are the actual expected processing times for this chat?
11. **Recommendations** — Any adjustments to the architecture doc based on real data

---

## 9. Execution Checklist

- [ ] Clone reference repos into `references/`
- [ ] Initialize Node.js project with TypeScript
- [ ] Implement parser with extended message fields (tokens, shape, language, mentions)
- [ ] Validate parser against the actual chat file
- [ ] Implement core analytics calculators (§4.1–4.6)
- [ ] Implement token & shape metrics (§4.7)
- [ ] Implement language metrics (§4.8)
- [ ] Implement LLM pipeline readiness metrics (§4.9)
- [ ] Implement comic-worthiness signal metrics (§4.10)
- [ ] Implement memory system signal metrics (§4.11)
- [ ] Implement session segmentation with all strategies and thresholds
- [ ] Build the web server with all API endpoints
- [ ] Build the web UI with all 7 tabs
- [ ] Run the full analysis and verify results in the web UI
- [ ] Generate the JSON report
- [ ] Fill in `conclusion.md` with findings
