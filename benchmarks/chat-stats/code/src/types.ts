export interface Message {
  id: number;
  timestamp: Date;
  sender: string; // empty string for system
  content: string;
  type: 'text' | 'system' | 'deleted' | 'link' | 'media_omitted';
  charCount: number;
  wordCount: number;
  estimatedTokens: number; // charCount / 4
  emojiCount: number;
  shape: 'emoji_only' | 'single_word' | 'short' | 'medium' | 'long' | 'media_placeholder';
  language: 'en' | 'hi' | 'hinglish' | 'other';
  hasUrl: boolean;
  hasMention: boolean;
  mentionedNames: string[];
}

export interface ParseResult {
  messages: Message[];
  members: string[];
  parseErrors: number;
  multiLineMessages: number;
  systemMessagesCount: number;
  mediaOmittedCount: number;
  deletedMessagesCount: number;
  timespan: { start: Date; end: Date };
  totalLines: number;
}

export interface SessionExperimentResult {
  strategy: string;
  threshold: string;
  sessionCount: number;
  avgMessagesPerSession: number;
  medianMessagesPerSession: number;
  minMessagesPerSession: number;
  maxMessagesPerSession: number;
  stdDevMessagesPerSession: number;
  sessionsWithLessThan5Msgs: number;
  sessionsWithLessThan10Msgs: number;
  sessionsWithMoreThan100Msgs: number;
  sessionsWithMoreThan200Msgs: number;
  avgSessionDurationMinutes: number;
  medianSessionDurationMinutes: number;
  avgParticipantsPerSession: number;
  singleParticipantSessions: number;
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

export interface SessionDetail {
  id: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  messageCount: number;
  participants: string[];
  firstMessagePreview: string;
  lastMessagePreview: string;
  estimatedInputTokens: number;
  noiseRatio: number;
}

export interface MemberMetrics {
  totalMessages: number;
  percentage: number;
  avgMessageLength: number;
  avgWordCount: number;
  medianMessageLength: number;
  longestMessage: number;
  shortMessageRate: number;
  emojiCount: number;
  mostUsedEmojis: { emoji: string; count: number }[];
  topWords: { word: string; count: number }[];
  firstMessageDate: string;
  lastMessageDate: string;
  activeDays: number;
  hourlyPattern: number[];
  initiationCount: number;
  avgTokens: number;
  languageDistribution: Record<string, number>;
  activityPerWeek: Record<string, number>;
}

export interface VolumeMetrics {
  totalMessages: number;
  totalSystemMessages: number;
  messagesPerMember: Record<string, number>;
  mediaOmittedCount: number;
  deletedCount: number;
  linkCount: number;
  messagesPerDay: Record<string, number>;
  messagesPerWeek: Record<string, number>;
  messagesPerMonth: Record<string, number>;
}

export interface TemporalMetrics {
  hourlyDistribution: number[];
  dayOfWeekDistribution: number[];
  heatmap: number[][]; // 7 x 24
  busiestDay: { date: string; count: number };
  quietestDay: { date: string; count: number };
  longestStreak: { days: number; start: string; end: string };
  longestSilence: { hours: number; start: string; end: string };
  averageMessagesPerDay: number;
  activeDays: number;
}

export interface SocialMetrics {
  replyMatrix: Record<string, Record<string, number>>;
  mentionMatrix: Record<string, Record<string, number>>;
  conversationStarters: Record<string, number>;
  ghosters: { member: string; netDifference: number; repliesReceived: number; repliesSent: number }[];
}

export interface ContentMetrics {
  globalTopWords: { word: string; count: number }[];
  globalTopEmojis: { emoji: string; count: number }[];
  avgGroupMessageLength: number;
  messagesByType: Record<string, number>;
}

export interface MilestoneItem {
  milestone: string;
  id: number;
  timestamp: string;
  sender: string;
  content: string;
}

export interface MilestonesMetrics {
  milestones: MilestoneItem[];
  firstMessage: MilestoneItem | null;
  groupCreationDate: string | null;
}

export interface TokenAndShapeMetrics {
  avgTokensPerMessage: number;
  medianTokensPerMessage: number;
  p95TokensPerMessage: number;
  avgCharsPerMessage: number;
  avgWordsPerMessage: number;
  tokenDistribution: Record<string, number>;
  shapeDistribution: Record<string, number>;
  noiseMessageRatio: number;
  contentMessageRatio: number;
  avgTokensPerMember: Record<string, number>;
}

export interface LanguageMetrics {
  languageDistribution: Record<string, number>;
  languageByMember: Record<string, Record<string, number>>;
  devanagariCharRatio: number;
  codeSwitchingRate: number;
}

export interface PipelineReadinessMetrics {
  contextWindowSimulation: {
    mean: number;
    median: number;
    p95: number;
    max: number;
    pctExceeding4K: number;
    pctExceeding8K: number;
    pctExceeding16K: number;
    pctExceeding32K: number;
    distribution: Record<string, number>;
  };
  sessionContentRichness: {
    mean: number;
    median: number;
    p25: number;
    pctLowRichness: number;
  };
  noiseRatioPerSession: {
    mean: number;
    median: number;
  };
  consecutiveSessionParticipantOverlap: {
    mean: number;
    median: number;
  };
  sessionTokenEstimates: {
    strategy: string;
    threshold: string;
    totalSessions: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
}

export interface ComicSignalMetrics {
  rapidExchanges: {
    timestamp: string;
    participants: string[];
    messageCount: number;
    durationSeconds: number;
    preview: string;
  }[];
  rapidExchangeCount: number;
  emotionalKeywordCounts: Record<string, number>;
  emotionalDensityPerSession: { sessionId: number; timestamp: string; density: number }[];
  eventMessages: { timestamp: string; sender: string; content: string; matchedKeyword: string }[];
  eventMessageCount: number;
  monologues: { sender: string; messageCount: number; durationMinutes: number; timestamp: string; preview: string }[];
  monologueCount: number;
  questionBursts: { sender: string; question: string; timestamp: string; responseCount: number }[];
  questionBurstCount: number;
}

export interface MemorySignalMetrics {
  repeatedPhrases: { phrase: string; count: number; sessions: number; members: number }[];
  repeatedPhraseCount: number;
  memberActivityEpochs: { member: string; transitions: { week: string; count: number; prevAvg: number; changeRatio: number }[] }[];
  avgEpochsPerMember: number;
  mentionGraphDensity: number;
  mentionGraph: { nodes: string[]; edges: { source: string; target: string; weight: number }[] };
  avgSubBurstsPerSession: number;
}

export interface ProcessingTimeEstimates {
  strategy: string;
  threshold: string;
  realAvgTokensPerMessage: number;
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimates: {
    hardware: string;
    rawTimeHours: number;
    optimizedTimeHours: number;
  }[];
  cloudCost: number;
  filterableSessionCount: number;
}

export interface BenchmarkReport {
  metadata: {
    chatFile: string;
    fileSize: string;
    totalLines: number;
    parsedAt: string;
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
  volumeMetrics: VolumeMetrics;
  temporalMetrics: TemporalMetrics;
  memberMetrics: Record<string, MemberMetrics>;
  socialMetrics: SocialMetrics;
  contentMetrics: ContentMetrics;
  milestones: MilestonesMetrics;
  tokenAndShapeMetrics: TokenAndShapeMetrics;
  languageMetrics: LanguageMetrics;
  pipelineReadiness: PipelineReadinessMetrics;
  comicSignals: ComicSignalMetrics;
  memorySignals: MemorySignalMetrics;
  sessionExperiments: SessionExperimentResult[];
  processingTimeEstimates: ProcessingTimeEstimates;
}
