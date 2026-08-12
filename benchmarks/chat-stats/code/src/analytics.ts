import {
  Message,
  VolumeMetrics,
  TemporalMetrics,
  MemberMetrics,
  SocialMetrics,
  ContentMetrics,
  MilestonesMetrics,
  TokenAndShapeMetrics,
  LanguageMetrics,
  PipelineReadinessMetrics,
  ComicSignalMetrics,
  MemorySignalMetrics,
  MilestoneItem
} from './types';

const STOP_WORDS = new Set([
  // English
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on',
  'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we',
  'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into',
  'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
  'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
  'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any',
  'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were', 'am', 'been', 'being',
  'had', 'has', 'did', 'does', 'doing', 'lol', 'omg', 'ok', 'okay', 'ur', 'im', 'bro',

  // Hindi / Hinglish
  'hai', 'h', 'haan', 'ha', 'he', 'ho', 'rha', 'rhe', 'rhi', 'raha', 'rahe', 'rahi',
  'tha', 'thi', 'the', 'me', 'mein', 'mai', 'main', 'pe', 'par', 'pr', 'ko', 'ka',
  'ki', 'ke', 'se', 'to', 'toh', 'bhi', 'n', 'na', 'nhi', 'nahi', 'ne', 'ye', 'yeh',
  'wo', 'woh', 'ky', 'kya', 'kyu', 'kyun', 'ab', 'kab', 'jab', 'tab', 'bas', 'chal',
  'accha', 'achha', 'ya', 'aur', 'fir', 'phir', 'waise', 'tak', 'kar', 'kr', 'kare',
  'karenge', 'karna', 'karu', 'dhyan', 'bta', 'btao', 'bata', 'batao', 'dekh', 'dekho',
  'sun', 'suno', 'log', 'wala', 'wali', 'wale', 'sab', 'sabhi', 'siraf', 'sirf',
  'aisi', 'aisa', 'aise', 'jaise', 'jaisa', 'bhai', 'yar', 'yaar', 'bhot', 'bahot',
  'bahut', 'baki', 'mera', 'meri', 'mere', 'tera', 'teri', 'tere', 'hum', 'hamara',
  'hamari', 'hamare', 'apna', 'apni', 'apne', 'bhi', 'tu', 'tum', 'aap'
]);

function getISOWeekKey(d: Date): string {
  const date = new Date(d.getTime());
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getISODateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getISOMonthKey(d: Date): string {
  return d.toISOString().substring(0, 7);
}

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

// Helper to segment messages into sessions by inactivity gap (in minutes)
export function segmentByInactivityGap(messages: Message[], gapMinutes: number): Message[][] {
  const sessions: Message[][] = [];
  let currentSession: Message[] = [];
  const gapMs = gapMinutes * 60 * 1000;

  for (const msg of messages) {
    if (currentSession.length === 0) {
      currentSession.push(msg);
    } else {
      const prevMsg = currentSession[currentSession.length - 1];
      const diff = msg.timestamp.getTime() - prevMsg.timestamp.getTime();
      if (diff > gapMs) {
        sessions.push(currentSession);
        currentSession = [msg];
      } else {
        currentSession.push(msg);
      }
    }
  }
  if (currentSession.length > 0) {
    sessions.push(currentSession);
  }
  return sessions;
}

// 4.1 Volume Metrics
export function computeVolumeMetrics(messages: Message[], members: string[]): VolumeMetrics {
  const nonSystem = messages.filter(m => m.type !== 'system');
  const systemMsgs = messages.filter(m => m.type === 'system');

  const messagesPerMember: Record<string, number> = {};
  for (const m of members) messagesPerMember[m] = 0;
  for (const msg of nonSystem) {
    if (msg.sender) {
      messagesPerMember[msg.sender] = (messagesPerMember[msg.sender] || 0) + 1;
    }
  }

  const sortedMembers = Object.entries(messagesPerMember)
    .sort((a, b) => b[1] - a[1]);
  const sortedMsgPerMember: Record<string, number> = {};
  for (const [k, v] of sortedMembers) sortedMsgPerMember[k] = v;

  const messagesPerDay: Record<string, number> = {};
  const messagesPerWeek: Record<string, number> = {};
  const messagesPerMonth: Record<string, number> = {};

  let mediaOmittedCount = 0;
  let deletedCount = 0;
  let linkCount = 0;

  for (const msg of nonSystem) {
    if (msg.type === 'media_omitted') mediaOmittedCount++;
    if (msg.type === 'deleted') deletedCount++;
    if (msg.type === 'link' || msg.hasUrl) linkCount++;

    const dayKey = getISODateKey(msg.timestamp);
    const weekKey = getISOWeekKey(msg.timestamp);
    const monthKey = getISOMonthKey(msg.timestamp);

    messagesPerDay[dayKey] = (messagesPerDay[dayKey] || 0) + 1;
    messagesPerWeek[weekKey] = (messagesPerWeek[weekKey] || 0) + 1;
    messagesPerMonth[monthKey] = (messagesPerMonth[monthKey] || 0) + 1;
  }

  return {
    totalMessages: nonSystem.length,
    totalSystemMessages: systemMsgs.length,
    messagesPerMember: sortedMsgPerMember,
    mediaOmittedCount,
    deletedCount,
    linkCount,
    messagesPerDay,
    messagesPerWeek,
    messagesPerMonth
  };
}

// 4.2 Temporal Metrics
export function computeTemporalMetrics(messages: Message[]): TemporalMetrics {
  const nonSystem = messages.filter(m => m.type !== 'system');
  const hourlyDistribution = new Array(24).fill(0);
  const dayOfWeekDistribution = new Array(7).fill(0); // Mon=0 .. Sun=6
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

  const dayCounts: Record<string, number> = {};

  for (const msg of nonSystem) {
    const hour = msg.timestamp.getUTCHours();
    // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat -> convert to 0=Mon, ..., 6=Sun
    const rawDay = msg.timestamp.getUTCDay();
    const dow = rawDay === 0 ? 6 : rawDay - 1;

    hourlyDistribution[hour]++;
    dayOfWeekDistribution[dow]++;
    heatmap[dow][hour]++;

    const dayKey = getISODateKey(msg.timestamp);
    dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
  }

  const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
  const busiestDay = sortedDays.length > 0 ? { date: sortedDays[0][0], count: sortedDays[0][1] } : { date: '', count: 0 };
  const quietestDay = sortedDays.length > 0 ? { date: sortedDays[sortedDays.length - 1][0], count: sortedDays[sortedDays.length - 1][1] } : { date: '', count: 0 };

  // Calculate streaks and active days
  const activeDateKeys = Object.keys(dayCounts).sort();
  const activeDays = activeDateKeys.length;
  const averageMessagesPerDay = activeDays > 0 ? Math.round((nonSystem.length / activeDays) * 10) / 10 : 0;

  let longestStreak = { days: 0, start: '', end: '' };
  if (activeDateKeys.length > 0) {
    let currStreak = 1;
    let streakStart = activeDateKeys[0];
    let maxStreak = 1;
    let maxStart = activeDateKeys[0];
    let maxEnd = activeDateKeys[0];

    for (let i = 1; i < activeDateKeys.length; i++) {
      const prevDate = new Date(activeDateKeys[i - 1]);
      const currDate = new Date(activeDateKeys[i]);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
      if (diffDays === 1) {
        currStreak++;
      } else {
        if (currStreak > maxStreak) {
          maxStreak = currStreak;
          maxStart = streakStart;
          maxEnd = activeDateKeys[i - 1];
        }
        currStreak = 1;
        streakStart = activeDateKeys[i];
      }
    }
    if (currStreak > maxStreak) {
      maxStreak = currStreak;
      maxStart = streakStart;
      maxEnd = activeDateKeys[activeDateKeys.length - 1];
    }
    longestStreak = { days: maxStreak, start: maxStart, end: maxEnd };
  }

  // Calculate longest silence
  let longestSilence = { hours: 0, start: '', end: '' };
  let maxGapMs = 0;
  for (let i = 1; i < nonSystem.length; i++) {
    const gapMs = nonSystem[i].timestamp.getTime() - nonSystem[i - 1].timestamp.getTime();
    if (gapMs > maxGapMs) {
      maxGapMs = gapMs;
      longestSilence = {
        hours: Math.round((gapMs / (1000 * 60 * 60)) * 10) / 10,
        start: nonSystem[i - 1].timestamp.toISOString(),
        end: nonSystem[i].timestamp.toISOString()
      };
    }
  }

  return {
    hourlyDistribution,
    dayOfWeekDistribution,
    heatmap,
    busiestDay,
    quietestDay,
    longestStreak,
    longestSilence,
    averageMessagesPerDay,
    activeDays
  };
}

// 4.3 Per-Member Behavioral Metrics
export function computeMemberMetrics(
  messages: Message[],
  members: string[],
  sessions30Min: Message[][]
): Record<string, MemberMetrics> {
  const nonSystem = messages.filter(m => m.type !== 'system');
  const totalNonSystem = nonSystem.length;

  // Initiation counts from 30min gap sessions
  const initiationCount: Record<string, number> = {};
  for (const m of members) initiationCount[m] = 0;
  for (const session of sessions30Min) {
    const firstNonSys = session.find(m => m.type !== 'system');
    if (firstNonSys && firstNonSys.sender) {
      initiationCount[firstNonSys.sender] = (initiationCount[firstNonSys.sender] || 0) + 1;
    }
  }

  const result: Record<string, MemberMetrics> = {};

  for (const member of members) {
    const memberMsgs = nonSystem.filter(m => m.sender === member);
    const count = memberMsgs.length;
    if (count === 0) continue;

    const percentage = Math.round((count / totalNonSystem) * 10000) / 100;
    const charCounts = memberMsgs.map(m => m.charCount).sort((a, b) => a - b);
    const totalChars = charCounts.reduce((a, b) => a + b, 0);
    const totalWords = memberMsgs.reduce((a, b) => a + b.wordCount, 0);

    const avgMessageLength = Math.round((totalChars / count) * 10) / 10;
    const avgWordCount = Math.round((totalWords / count) * 10) / 10;
    const medianMessageLength = percentile(charCounts, 50);
    const longestMessage = charCounts[charCounts.length - 1] || 0;

    const shortMsgs = memberMsgs.filter(m => m.wordCount <= 3).length;
    const shortMessageRate = Math.round((shortMsgs / count) * 10000) / 100;

    const emojiCount = memberMsgs.reduce((a, b) => a + b.emojiCount, 0);

    // Emoji frequency
    const emojiMap: Record<string, number> = {};
    for (const msg of memberMsgs) {
      const emojis = msg.content.match(/\p{Extended_Pictographic}/gu) || [];
      for (const e of emojis) {
        emojiMap[e] = (emojiMap[e] || 0) + 1;
      }
    }
    const mostUsedEmojis = Object.entries(emojiMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([emoji, count]) => ({ emoji, count }));

    // Word frequency (excluding stop words)
    const wordMap: Record<string, number> = {};
    for (const msg of memberMsgs) {
      if (msg.type === 'media_omitted' || msg.type === 'deleted') continue;
      const words = msg.content.toLowerCase().split(/\s+/);
      for (let w of words) {
        w = w.replace(/[^a-z0-9]/g, '');
        if (w.length > 2 && !STOP_WORDS.has(w)) {
          wordMap[w] = (wordMap[w] || 0) + 1;
        }
      }
    }
    const topWords = Object.entries(wordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    const dates = memberMsgs.map(m => m.timestamp.getTime()).sort((a, b) => a - b);
    const firstMessageDate = new Date(dates[0]).toISOString();
    const lastMessageDate = new Date(dates[dates.length - 1]).toISOString();

    const activeDaysSet = new Set<string>();
    const hourlyPattern = new Array(24).fill(0);
    const langDist: Record<string, number> = { en: 0, hi: 0, hinglish: 0, other: 0 };
    const activityPerWeek: Record<string, number> = {};

    let totalTokens = 0;

    for (const msg of memberMsgs) {
      activeDaysSet.add(getISODateKey(msg.timestamp));
      hourlyPattern[msg.timestamp.getUTCHours()]++;
      langDist[msg.language] = (langDist[msg.language] || 0) + 1;

      const wKey = getISOWeekKey(msg.timestamp);
      activityPerWeek[wKey] = (activityPerWeek[wKey] || 0) + 1;
      totalTokens += msg.estimatedTokens;
    }

    result[member] = {
      totalMessages: count,
      percentage,
      avgMessageLength,
      avgWordCount,
      medianMessageLength,
      longestMessage,
      shortMessageRate,
      emojiCount,
      mostUsedEmojis,
      topWords,
      firstMessageDate,
      lastMessageDate,
      activeDays: activeDaysSet.size,
      hourlyPattern,
      initiationCount: initiationCount[member] || 0,
      avgTokens: Math.round((totalTokens / count) * 10) / 10,
      languageDistribution: langDist,
      activityPerWeek
    };
  }

  return result;
}

// 4.4 Social / Interaction Metrics
export function computeSocialMetrics(
  messages: Message[],
  members: string[],
  sessions30Min: Message[][]
): SocialMetrics {
  const nonSystem = messages.filter(m => m.type !== 'system');
  const replyMatrix: Record<string, Record<string, number>> = {};
  const mentionMatrix: Record<string, Record<string, number>> = {};

  for (const m1 of members) {
    replyMatrix[m1] = {};
    mentionMatrix[m1] = {};
    for (const m2 of members) {
      replyMatrix[m1][m2] = 0;
      mentionMatrix[m1][m2] = 0;
    }
  }

  // Reply matrix: member A messages right after member B within 5 min
  const FIVE_MIN_MS = 5 * 60 * 1000;
  for (let i = 1; i < nonSystem.length; i++) {
    const curr = nonSystem[i];
    const prev = nonSystem[i - 1];
    if (curr.sender && prev.sender && curr.sender !== prev.sender) {
      const gap = curr.timestamp.getTime() - prev.timestamp.getTime();
      if (gap <= FIVE_MIN_MS) {
        if (replyMatrix[curr.sender] && replyMatrix[curr.sender][prev.sender] !== undefined) {
          replyMatrix[curr.sender][prev.sender]++;
        }
      }
    }
  }

  // Mention matrix
  for (const msg of nonSystem) {
    if (msg.sender && msg.mentionedNames.length > 0) {
      for (const name of msg.mentionedNames) {
        // match name to members
        const matchedMember = members.find(
          m => m.toLowerCase() === name.toLowerCase() || m.toLowerCase().includes(name.toLowerCase())
        );
        if (matchedMember && mentionMatrix[msg.sender] && mentionMatrix[msg.sender][matchedMember] !== undefined) {
          mentionMatrix[msg.sender][matchedMember]++;
        }
      }
    }
  }

  // Conversation starters
  const conversationStarters: Record<string, number> = {};
  for (const m of members) conversationStarters[m] = 0;
  for (const session of sessions30Min) {
    const firstMsg = session.find(m => m.type !== 'system');
    if (firstMsg && firstMsg.sender) {
      conversationStarters[firstMsg.sender] = (conversationStarters[firstMsg.sender] || 0) + 1;
    }
  }

  // Ghosters: (repliesReceived - repliesSent)
  const ghosters = members.map(m => {
    let repliesSent = 0;
    let repliesReceived = 0;
    for (const other of members) {
      if (other !== m) {
        repliesSent += replyMatrix[m]?.[other] || 0;
        repliesReceived += replyMatrix[other]?.[m] || 0;
      }
    }
    return {
      member: m,
      netDifference: repliesReceived - repliesSent,
      repliesReceived,
      repliesSent
    };
  }).sort((a, b) => b.netDifference - a.netDifference);

  return {
    replyMatrix,
    mentionMatrix,
    conversationStarters,
    ghosters
  };
}

// 4.5 Content Metrics
export function computeContentMetrics(messages: Message[]): ContentMetrics {
  const nonSystem = messages.filter(m => m.type !== 'system');
  const wordMap: Record<string, number> = {};
  const emojiMap: Record<string, number> = {};
  const messagesByType: Record<string, number> = {
    text: 0,
    system: 0,
    deleted: 0,
    link: 0,
    media_omitted: 0
  };

  let totalChars = 0;

  for (const msg of messages) {
    messagesByType[msg.type] = (messagesByType[msg.type] || 0) + 1;
    if (msg.type === 'system') continue;

    totalChars += msg.charCount;

    if (msg.type !== 'media_omitted' && msg.type !== 'deleted') {
      const words = msg.content.toLowerCase().split(/\s+/);
      for (let w of words) {
        w = w.replace(/[^a-z0-9]/g, '');
        if (w.length > 2 && !STOP_WORDS.has(w)) {
          wordMap[w] = (wordMap[w] || 0) + 1;
        }
      }
    }

    const emojis = msg.content.match(/\p{Extended_Pictographic}/gu) || [];
    for (const e of emojis) {
      emojiMap[e] = (emojiMap[e] || 0) + 1;
    }
  }

  const globalTopWords = Object.entries(wordMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({ word, count }));

  const globalTopEmojis = Object.entries(emojiMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([emoji, count]) => ({ emoji, count }));

  const avgGroupMessageLength = nonSystem.length > 0 ? Math.round((totalChars / nonSystem.length) * 10) / 10 : 0;

  return {
    globalTopWords,
    globalTopEmojis,
    avgGroupMessageLength,
    messagesByType
  };
}

// 4.6 Milestone Metrics
export function computeMilestonesMetrics(messages: Message[]): MilestonesMetrics {
  const nonSystem = messages.filter(m => m.type !== 'system');
  const marks = [1000, 5000, 10000, 25000, 50000, 100000];
  const milestones: MilestoneItem[] = [];

  for (const mark of marks) {
    if (nonSystem.length >= mark) {
      const msg = nonSystem[mark - 1];
      milestones.push({
        milestone: `${mark / 1000}K`,
        id: msg.id,
        timestamp: msg.timestamp.toISOString(),
        sender: msg.sender,
        content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content
      });
    }
  }

  const firstMsg = nonSystem.length > 0 ? nonSystem[0] : null;
  const firstMessageItem: MilestoneItem | null = firstMsg ? {
    milestone: 'First Message',
    id: firstMsg.id,
    timestamp: firstMsg.timestamp.toISOString(),
    sender: firstMsg.sender,
    content: firstMsg.content
  } : null;

  const groupCreationSysMsg = messages.find(m => m.type === 'system' && m.content.includes('created group'));
  const groupCreationDate = groupCreationSysMsg ? groupCreationSysMsg.timestamp.toISOString() : (messages[0]?.timestamp.toISOString() || null);

  return {
    milestones,
    firstMessage: firstMessageItem,
    groupCreationDate
  };
}

// 4.7 Token & Message Shape Metrics
export function computeTokenAndShapeMetrics(messages: Message[], members: string[]): TokenAndShapeMetrics {
  const nonSystem = messages.filter(m => m.type !== 'system');
  if (nonSystem.length === 0) {
    return {
      avgTokensPerMessage: 0,
      medianTokensPerMessage: 0,
      p95TokensPerMessage: 0,
      avgCharsPerMessage: 0,
      avgWordsPerMessage: 0,
      tokenDistribution: {},
      shapeDistribution: {},
      noiseMessageRatio: 0,
      contentMessageRatio: 0,
      avgTokensPerMember: {}
    };
  }

  const tokensArr = nonSystem.map(m => m.estimatedTokens).sort((a, b) => a - b);
  const totalTokens = tokensArr.reduce((a, b) => a + b, 0);
  const totalChars = nonSystem.reduce((a, b) => a + b.charCount, 0);
  const totalWords = nonSystem.reduce((a, b) => a + b.wordCount, 0);

  const avgTokensPerMessage = Math.round((totalTokens / nonSystem.length) * 10) / 10;
  const medianTokensPerMessage = percentile(tokensArr, 50);
  const p95TokensPerMessage = percentile(tokensArr, 95);
  const avgCharsPerMessage = Math.round((totalChars / nonSystem.length) * 10) / 10;
  const avgWordsPerMessage = Math.round((totalWords / nonSystem.length) * 10) / 10;

  const tokenDistribution: Record<string, number> = {
    '1-5': 0,
    '6-10': 0,
    '11-20': 0,
    '21-50': 0,
    '51-100': 0,
    '100+': 0
  };

  const shapeDistribution: Record<string, number> = {
    emoji_only: 0,
    single_word: 0,
    short: 0,
    medium: 0,
    long: 0,
    media_placeholder: 0
  };

  let noiseCount = 0;

  for (const msg of nonSystem) {
    const t = msg.estimatedTokens;
    if (t <= 5) tokenDistribution['1-5']++;
    else if (t <= 10) tokenDistribution['6-10']++;
    else if (t <= 20) tokenDistribution['11-20']++;
    else if (t <= 50) tokenDistribution['21-50']++;
    else if (t <= 100) tokenDistribution['51-100']++;
    else tokenDistribution['100+']++;

    shapeDistribution[msg.shape] = (shapeDistribution[msg.shape] || 0) + 1;

    if (
      msg.shape === 'emoji_only' ||
      msg.shape === 'single_word' ||
      msg.shape === 'media_placeholder'
    ) {
      noiseCount++;
    }
  }

  const noiseMessageRatio = Math.round((noiseCount / nonSystem.length) * 10000) / 100;
  const contentMessageRatio = Math.round((100 - noiseMessageRatio) * 100) / 100;

  const avgTokensPerMember: Record<string, number> = {};
  for (const m of members) {
    const mMsgs = nonSystem.filter(msg => msg.sender === m);
    if (mMsgs.length > 0) {
      const sum = mMsgs.reduce((a, b) => a + b.estimatedTokens, 0);
      avgTokensPerMember[m] = Math.round((sum / mMsgs.length) * 10) / 10;
    }
  }

  return {
    avgTokensPerMessage,
    medianTokensPerMessage,
    p95TokensPerMessage,
    avgCharsPerMessage,
    avgWordsPerMessage,
    tokenDistribution,
    shapeDistribution,
    noiseMessageRatio,
    contentMessageRatio,
    avgTokensPerMember
  };
}

// 4.8 Language Metrics
export function computeLanguageMetrics(messages: Message[], members: string[]): LanguageMetrics {
  const nonSystem = messages.filter(m => m.type !== 'system');
  const languageDistribution: Record<string, number> = { en: 0, hi: 0, hinglish: 0, other: 0 };
  const languageByMember: Record<string, Record<string, number>> = {};

  for (const m of members) {
    languageByMember[m] = { en: 0, hi: 0, hinglish: 0, other: 0 };
  }

  let totalDevanagari = 0;
  let totalAlpha = 0;
  let hinglishCount = 0;

  for (const msg of nonSystem) {
    languageDistribution[msg.language] = (languageDistribution[msg.language] || 0) + 1;
    if (msg.sender && languageByMember[msg.sender]) {
      languageByMember[msg.sender][msg.language]++;
    }

    if (msg.language === 'hinglish') hinglishCount++;

    const dev = (msg.content.match(/[\u0900-\u097F]/g) || []).length;
    const lat = (msg.content.match(/[a-zA-Z]/g) || []).length;
    totalDevanagari += dev;
    totalAlpha += (dev + lat);
  }

  const devanagariCharRatio = totalAlpha > 0 ? Math.round((totalDevanagari / totalAlpha) * 10000) / 100 : 0;
  const codeSwitchingRate = nonSystem.length > 0 ? Math.round((hinglishCount / nonSystem.length) * 10000) / 100 : 0;

  return {
    languageDistribution,
    languageByMember,
    devanagariCharRatio,
    codeSwitchingRate
  };
}

// 4.9 LLM Pipeline Readiness Metrics
export function computePipelineReadinessMetrics(
  messages: Message[],
  sessions30Min: Message[][]
): PipelineReadinessMetrics {
  const avgTokensMsg = messages.length > 0 ? messages.reduce((a, b) => a + b.estimatedTokens, 0) / messages.length : 15;

  const tokenSimArr: number[] = [];
  const dist: Record<string, number> = {
    '< 4K': 0,
    '4K-8K': 0,
    '8K-16K': 0,
    '16K-32K': 0,
    '32K+': 0
  };

  let count4K = 0, count8K = 0, count16K = 0, count32K = 0;

  const richnessScores: number[] = [];
  const noiseRatios: number[] = [];
  const jaccardOverlaps: number[] = [];

  for (let i = 0; i < sessions30Min.length; i++) {
    const session = sessions30Min[i];
    const sessionNonSystem = session.filter(m => m.type !== 'system');
    const msgCount = sessionNonSystem.length;

    // Token simulation: 4000 overhead + (msgCount * avgTokensMsg)
    const tokens = 4000 + Math.round(msgCount * avgTokensMsg);
    tokenSimArr.push(tokens);

    if (tokens < 4000) dist['< 4K']++;
    else if (tokens <= 8000) dist['4K-8K']++;
    else if (tokens <= 16000) dist['8K-16K']++;
    else if (tokens <= 32000) dist['16K-32K']++;
    else dist['32K+']++;

    if (tokens > 4000) count4K++;
    if (tokens > 8000) count8K++;
    if (tokens > 16000) count16K++;
    if (tokens > 32000) count32K++;

    // Session richness
    const participants = new Set(sessionNonSystem.map(m => m.sender).filter(Boolean));
    const totalWords = sessionNonSystem.reduce((a, b) => a + b.wordCount, 0);
    const avgWordCount = msgCount > 0 ? totalWords / msgCount : 0;
    const durationMinutes = Math.max(
      1,
      (session[session.length - 1].timestamp.getTime() - session[0].timestamp.getTime()) / 60000
    );

    const richness = (participants.size * avgWordCount * msgCount) / durationMinutes;
    richnessScores.push(richness);

    // Noise ratio per session
    let noiseMsgs = 0;
    for (const msg of sessionNonSystem) {
      if (
        msg.shape === 'emoji_only' ||
        msg.shape === 'single_word' ||
        msg.shape === 'media_placeholder'
      ) {
        noiseMsgs++;
      }
    }
    noiseRatios.push(msgCount > 0 ? noiseMsgs / msgCount : 0);

    // Consecutive participant overlap
    if (i < sessions30Min.length - 1) {
      const nextSession = sessions30Min[i + 1];
      const nextP = new Set(nextSession.filter(m => m.type !== 'system').map(m => m.sender).filter(Boolean));
      const union = new Set([...participants, ...nextP]);
      let intersectionCount = 0;
      for (const p of participants) {
        if (nextP.has(p)) intersectionCount++;
      }
      const jaccard = union.size > 0 ? intersectionCount / union.size : 0;
      jaccardOverlaps.push(jaccard);
    }
  }

  tokenSimArr.sort((a, b) => a - b);
  richnessScores.sort((a, b) => a - b);

  const totalS = sessions30Min.length || 1;
  const p25Richness = percentile(richnessScores, 25);
  const lowRichnessCount = richnessScores.filter(r => r <= p25Richness).length;

  const avgNoiseRatio = noiseRatios.length > 0 ? noiseRatios.reduce((a, b) => a + b, 0) / noiseRatios.length : 0;
  const avgOverlap = jaccardOverlaps.length > 0 ? jaccardOverlaps.reduce((a, b) => a + b, 0) / jaccardOverlaps.length : 0;

  return {
    contextWindowSimulation: {
      mean: Math.round((tokenSimArr.reduce((a, b) => a + b, 0) / totalS)),
      median: percentile(tokenSimArr, 50),
      p95: percentile(tokenSimArr, 95),
      max: tokenSimArr[tokenSimArr.length - 1] || 0,
      pctExceeding4K: Math.round((count4K / totalS) * 10000) / 100,
      pctExceeding8K: Math.round((count8K / totalS) * 10000) / 100,
      pctExceeding16K: Math.round((count16K / totalS) * 10000) / 100,
      pctExceeding32K: Math.round((count32K / totalS) * 10000) / 100,
      distribution: dist
    },
    sessionContentRichness: {
      mean: Math.round((richnessScores.reduce((a, b) => a + b, 0) / totalS) * 10) / 10,
      median: Math.round(percentile(richnessScores, 50) * 10) / 10,
      p25: Math.round(p25Richness * 10) / 10,
      pctLowRichness: Math.round((lowRichnessCount / totalS) * 10000) / 100
    },
    noiseRatioPerSession: {
      mean: Math.round(avgNoiseRatio * 10000) / 100,
      median: Math.round(percentile(noiseRatios.sort((a, b) => a - b), 50) * 10000) / 100
    },
    consecutiveSessionParticipantOverlap: {
      mean: Math.round(avgOverlap * 100) / 100,
      median: Math.round(percentile(jaccardOverlaps.sort((a, b) => a - b), 50) * 100) / 100
    },
    sessionTokenEstimates: {
      strategy: 'Inactivity Gap',
      threshold: '30min',
      totalSessions: sessions30Min.length,
      totalInputTokens: tokenSimArr.reduce((a, b) => a + b, 0),
      totalOutputTokens: sessions30Min.length * 600
    }
  };
}

// 4.10 Comic-Worthiness Signal Metrics
export function computeComicSignalMetrics(
  messages: Message[],
  sessions30Min: Message[][]
): ComicSignalMetrics {
  const nonSystem = messages.filter(m => m.type !== 'system');

  // Rapid exchanges: 3+ unique senders exchange 5+ messages within 2-min window
  const rapidExchanges: ComicSignalMetrics['rapidExchanges'] = [];
  const WINDOW_MS = 2 * 60 * 1000;

  for (let i = 0; i < nonSystem.length; i++) {
    const startMsg = nonSystem[i];
    const senders = new Set<string>();
    if (startMsg.sender) senders.add(startMsg.sender);

    let j = i + 1;
    while (j < nonSystem.length && (nonSystem[j].timestamp.getTime() - startMsg.timestamp.getTime()) <= WINDOW_MS) {
      if (nonSystem[j].sender) senders.add(nonSystem[j].sender);
      j++;
    }

    const msgCount = j - i;
    if (senders.size >= 3 && msgCount >= 5) {
      const endMsg = nonSystem[j - 1];
      const durationSeconds = Math.round((endMsg.timestamp.getTime() - startMsg.timestamp.getTime()) / 1000);
      const preview = nonSystem.slice(i, Math.min(i + 3, j)).map(m => `${m.sender}: ${m.content}`).join(' | ');

      rapidExchanges.push({
        timestamp: startMsg.timestamp.toISOString(),
        participants: Array.from(senders),
        messageCount: msgCount,
        durationSeconds,
        preview
      });

      // Jump past window to avoid duplicate overlap
      i = j - 1;
    }
  }

  // Emotional keywords
  const emotionalKeywordCounts: Record<string, number> = {
    laughter: 0,
    excitement: 0,
    conflict: 0,
    affection: 0
  };

  const LAUGHTER = [/haha/i, /hehe/i, /lmao/i, /lmfao/i, /rofl/i, /😂/u, /🤣/u, /💀/u];
  const EXCITEMENT = [/!!/, /🔥/u, /lessgo/i, /letsgoo/i, /yessss/i, /🎉/u];
  const CONFLICT = [/wtf/i, /stfu/i, /chup/i, /pagal/i, /🤬/u];
  const AFFECTION = [/❤️/u, /🥺/u, /love/i, /miss/i, /pyaar/i];

  const emotionalDensityPerSession: ComicSignalMetrics['emotionalDensityPerSession'] = [];

  for (let sIdx = 0; sIdx < sessions30Min.length; sIdx++) {
    const session = sessions30Min[sIdx];
    let sessionEmoCount = 0;

    for (const msg of session) {
      let matched = false;
      for (const r of LAUGHTER) { if (r.test(msg.content)) { emotionalKeywordCounts.laughter++; matched = true; break; } }
      for (const r of EXCITEMENT) { if (r.test(msg.content)) { emotionalKeywordCounts.excitement++; matched = true; break; } }
      for (const r of CONFLICT) { if (r.test(msg.content)) { emotionalKeywordCounts.conflict++; matched = true; break; } }
      for (const r of AFFECTION) { if (r.test(msg.content)) { emotionalKeywordCounts.affection++; matched = true; break; } }

      if (matched) sessionEmoCount++;
    }

    const density = session.length > 0 ? Math.round((sessionEmoCount / session.length) * 100) / 100 : 0;
    emotionalDensityPerSession.push({
      sessionId: sIdx,
      timestamp: session[0].timestamp.toISOString(),
      density
    });
  }

  // Event messages
  const EVENT_KEYWORDS = ['trip', 'party', 'exam', 'birthday', 'plan', 'tomorrow', 'weekend', 'movie', 'dinner', 'match', 'college', 'fest', 'meetup'];
  const eventMessages: ComicSignalMetrics['eventMessages'] = [];

  for (const msg of nonSystem) {
    const lower = msg.content.toLowerCase();
    for (const kw of EVENT_KEYWORDS) {
      if (lower.includes(kw)) {
        eventMessages.push({
          timestamp: msg.timestamp.toISOString(),
          sender: msg.sender,
          content: msg.content,
          matchedKeyword: kw
        });
        break;
      }
    }
  }

  // Monologues: 5+ consecutive messages by 1 person with no replies in between
  const monologues: ComicSignalMetrics['monologues'] = [];
  let currSender = '';
  let currChain: Message[] = [];

  for (const msg of nonSystem) {
    if (msg.sender === currSender) {
      currChain.push(msg);
    } else {
      if (currChain.length >= 5) {
        const startT = currChain[0].timestamp.getTime();
        const endT = currChain[currChain.length - 1].timestamp.getTime();
        const durationMinutes = Math.round(((endT - startT) / 60000) * 10) / 10;
        monologues.push({
          sender: currSender,
          messageCount: currChain.length,
          durationMinutes,
          timestamp: currChain[0].timestamp.toISOString(),
          preview: currChain.slice(0, 2).map(m => m.content).join(' ')
        });
      }
      currSender = msg.sender;
      currChain = [msg];
    }
  }
  if (currChain.length >= 5) {
    const startT = currChain[0].timestamp.getTime();
    const endT = currChain[currChain.length - 1].timestamp.getTime();
    const durationMinutes = Math.round(((endT - startT) / 60000) * 10) / 10;
    monologues.push({
      sender: currSender,
      messageCount: currChain.length,
      durationMinutes,
      timestamp: currChain[0].timestamp.toISOString(),
      preview: currChain.slice(0, 2).map(m => m.content).join(' ')
    });
  }

  // Question bursts: Message ending with ? getting 3+ responses within 5 min
  const questionBursts: ComicSignalMetrics['questionBursts'] = [];
  const FIVE_MIN = 5 * 60 * 1000;

  for (let i = 0; i < nonSystem.length; i++) {
    const msg = nonSystem[i];
    if (msg.content.trim().endsWith('?')) {
      let respCount = 0;
      let j = i + 1;
      while (j < nonSystem.length && (nonSystem[j].timestamp.getTime() - msg.timestamp.getTime()) <= FIVE_MIN) {
        if (nonSystem[j].sender && nonSystem[j].sender !== msg.sender) {
          respCount++;
        }
        j++;
      }
      if (respCount >= 3) {
        questionBursts.push({
          sender: msg.sender,
          question: msg.content,
          timestamp: msg.timestamp.toISOString(),
          responseCount: respCount
        });
      }
    }
  }

  return {
    rapidExchanges: rapidExchanges.slice(0, 50),
    rapidExchangeCount: rapidExchanges.length,
    emotionalKeywordCounts,
    emotionalDensityPerSession,
    eventMessages: eventMessages.slice(0, 100),
    eventMessageCount: eventMessages.length,
    monologues: monologues.slice(0, 50),
    monologueCount: monologues.length,
    questionBursts: questionBursts.slice(0, 50),
    questionBurstCount: questionBursts.length
  };
}

// 4.11 Memory System Signal Metrics
export function computeMemorySignalMetrics(
  messages: Message[],
  members: string[],
  sessions30Min: Message[][]
): MemorySignalMetrics {
  const nonSystem = messages.filter(m => m.type !== 'system');

  // Repeated phrases: 3+ word n-grams in 3+ sessions by 2+ members
  const nGramSessions: Record<string, Set<number>> = {};
  const nGramMembers: Record<string, Set<string>> = {};
  const nGramCount: Record<string, number> = {};

  for (let sIdx = 0; sIdx < sessions30Min.length; sIdx++) {
    const session = sessions30Min[sIdx];
    for (const msg of session) {
      if (msg.type === 'media_omitted' || msg.type === 'deleted' || !msg.sender) continue;
      const cleanText = msg.content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const words = cleanText.split(/\s+/).filter(Boolean);

      for (let i = 0; i <= words.length - 3; i++) {
        const phrase = words.slice(i, i + 3).join(' ');
        // Filter out phrases made entirely of stop words
        if (phrase.split(' ').every(w => STOP_WORDS.has(w))) continue;

        nGramCount[phrase] = (nGramCount[phrase] || 0) + 1;
        if (!nGramSessions[phrase]) nGramSessions[phrase] = new Set();
        if (!nGramMembers[phrase]) nGramMembers[phrase] = new Set();

        nGramSessions[phrase].add(sIdx);
        nGramMembers[phrase].add(msg.sender);
      }
    }
  }

  const repeatedPhrases: MemorySignalMetrics['repeatedPhrases'] = [];
  for (const [phrase, count] of Object.entries(nGramCount)) {
    const sessCount = nGramSessions[phrase]?.size || 0;
    const membCount = nGramMembers[phrase]?.size || 0;
    if (sessCount >= 3 && membCount >= 2) {
      repeatedPhrases.push({
        phrase,
        count,
        sessions: sessCount,
        members: membCount
      });
    }
  }

  repeatedPhrases.sort((a, b) => b.count - a.count);

  // Member activity epochs: week-by-week messages per member, detecting >50% shifts from 4-week rolling avg
  const memberActivityEpochs: MemorySignalMetrics['memberActivityEpochs'] = [];
  let totalEpochTransitions = 0;

  for (const m of members) {
    const mMsgs = nonSystem.filter(msg => msg.sender === m);
    const weekCounts: Record<string, number> = {};
    for (const msg of mMsgs) {
      const wKey = getISOWeekKey(msg.timestamp);
      weekCounts[wKey] = (weekCounts[wKey] || 0) + 1;
    }

    const weeks = Object.keys(weekCounts).sort();
    const transitions: { week: string; count: number; prevAvg: number; changeRatio: number }[] = [];

    for (let i = 4; i < weeks.length; i++) {
      const prev4 = weeks.slice(i - 4, i).reduce((sum, w) => sum + weekCounts[w], 0) / 4;
      const curr = weekCounts[weeks[i]];
      if (prev4 > 5) {
        const changeRatio = Math.abs(curr - prev4) / prev4;
        if (changeRatio > 0.5) {
          transitions.push({
            week: weeks[i],
            count: curr,
            prevAvg: Math.round(prev4 * 10) / 10,
            changeRatio: Math.round(changeRatio * 100) / 100
          });
        }
      }
    }

    totalEpochTransitions += transitions.length;
    memberActivityEpochs.push({
      member: m,
      transitions
    });
  }

  const avgEpochsPerMember = members.length > 0 ? Math.round((totalEpochTransitions / members.length) * 10) / 10 : 0;

  // Mention graph density
  const mentionMatrix: Record<string, Record<string, number>> = {};
  for (const m1 of members) {
    mentionMatrix[m1] = {};
    for (const m2 of members) mentionMatrix[m1][m2] = 0;
  }

  for (const msg of nonSystem) {
    if (msg.sender && msg.mentionedNames.length > 0) {
      for (const name of msg.mentionedNames) {
        const matched = members.find(m => m.toLowerCase() === name.toLowerCase() || m.toLowerCase().includes(name.toLowerCase()));
        if (matched && mentionMatrix[msg.sender]) {
          mentionMatrix[msg.sender][matched]++;
        }
      }
    }
  }

  let edgeCount = 0;
  const edges: { source: string; target: string; weight: number }[] = [];
  for (const m1 of members) {
    for (const m2 of members) {
      if (m1 !== m2 && mentionMatrix[m1][m2] > 0) {
        edgeCount++;
        edges.push({ source: m1, target: m2, weight: mentionMatrix[m1][m2] });
      }
    }
  }

  const possibleEdges = members.length * (members.length - 1);
  const mentionGraphDensity = possibleEdges > 0 ? Math.round((edgeCount / possibleEdges) * 100) / 100 : 0;

  // Burst patterns: sub-bursts (<30s gap) separated by >3min (180s) pauses within 30-min sessions
  let totalSubBursts = 0;
  let totalSubBurstLength = 0;

  for (const session of sessions30Min) {
    const sessionNonSys = session.filter(m => m.type !== 'system');
    if (sessionNonSys.length === 0) continue;

    let currentBurstLength = 1;
    let burstCountInSession = 1;

    for (let i = 1; i < sessionNonSys.length; i++) {
      const gapSec = (sessionNonSys[i].timestamp.getTime() - sessionNonSys[i - 1].timestamp.getTime()) / 1000;
      if (gapSec <= 30) {
        currentBurstLength++;
      } else if (gapSec > 180) {
        totalSubBurstLength += currentBurstLength;
        totalSubBursts++;
        burstCountInSession++;
        currentBurstLength = 1;
      }
    }
    totalSubBurstLength += currentBurstLength;
    totalSubBursts++;
  }

  const avgSubBurstsPerSession = sessions30Min.length > 0 ? Math.round((totalSubBursts / sessions30Min.length) * 10) / 10 : 0;

  return {
    repeatedPhrases: repeatedPhrases.slice(0, 20),
    repeatedPhraseCount: repeatedPhrases.length,
    memberActivityEpochs,
    avgEpochsPerMember,
    mentionGraphDensity,
    mentionGraph: { nodes: members, edges },
    avgSubBurstsPerSession
  };
}
