import { Message, SessionExperimentResult, SessionDetail, ProcessingTimeEstimates } from './types';

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

function stdDev(arr: number[], mean: number): number {
  if (arr.length === 0) return 0;
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

// 1. Inactivity Gap Strategy
export function segmentInactivityGap(messages: Message[], gapMinutes: number): Message[][] {
  const sessions: Message[][] = [];
  let current: Message[] = [];
  const gapMs = gapMinutes * 60 * 1000;

  for (const msg of messages) {
    if (current.length === 0) {
      current.push(msg);
    } else {
      const prev = current[current.length - 1];
      const diff = msg.timestamp.getTime() - prev.timestamp.getTime();
      if (diff > gapMs) {
        sessions.push(current);
        current = [msg];
      } else {
        current.push(msg);
      }
    }
  }
  if (current.length > 0) sessions.push(current);
  return sessions;
}

// 2. Time-of-Day Aware Strategy
export function segmentTimeOfDayAware(messages: Message[], gapMinutes: number): Message[][] {
  const sessions: Message[][] = [];
  let current: Message[] = [];
  const baseGapMs = gapMinutes * 60 * 1000;
  const sleepGapMs = 15 * 60 * 1000;

  for (const msg of messages) {
    if (current.length === 0) {
      current.push(msg);
    } else {
      const prev = current[current.length - 1];
      const diff = msg.timestamp.getTime() - prev.timestamp.getTime();
      const hour = msg.timestamp.getUTCHours();
      const isSleepHour = hour >= 0 && hour < 6;

      if (diff > baseGapMs || (isSleepHour && diff > sleepGapMs)) {
        sessions.push(current);
        current = [msg];
      } else {
        current.push(msg);
      }
    }
  }
  if (current.length > 0) sessions.push(current);
  return sessions;
}

// 3. Participant Shift Strategy (30min base gap + N=10 window shift check)
export function segmentParticipantShift(messages: Message[], gapMinutes: number = 30, windowSize: number = 10): Message[][] {
  const baseSessions = segmentInactivityGap(messages, gapMinutes);
  const resultSessions: Message[][] = [];

  for (const session of baseSessions) {
    if (session.length <= windowSize * 2) {
      resultSessions.push(session);
      continue;
    }

    let subSession: Message[] = [];
    for (let i = 0; i < session.length; i++) {
      subSession.push(session[i]);

      if (i >= windowSize && i <= session.length - windowSize) {
        const prevWindow = session.slice(i - windowSize, i).map(m => m.sender).filter(Boolean);
        const nextWindow = session.slice(i, i + windowSize).map(m => m.sender).filter(Boolean);

        const prevSet = new Set(prevWindow);
        const nextSet = new Set(nextWindow);

        if (prevSet.size > 0 && nextSet.size > 0) {
          const union = new Set([...prevSet, ...nextSet]);
          let inter = 0;
          for (const p of prevSet) { if (nextSet.has(p)) inter++; }
          const overlap = inter / union.size;

          if (overlap < 0.5 && subSession.length >= 5) {
            resultSessions.push(subSession);
            subSession = [];
          }
        }
      }
    }
    if (subSession.length > 0) {
      resultSessions.push(subSession);
    }
  }

  return resultSessions;
}

// Evaluates a set of sessions to produce SessionExperimentResult
export function evaluateSessionExperiment(
  strategy: string,
  threshold: string,
  sessions: Message[][]
): SessionExperimentResult {
  const sessionCount = sessions.length;
  const msgCounts: number[] = [];
  const durations: number[] = [];
  const participantCounts: number[] = [];

  let lessThan5 = 0;
  let lessThan10 = 0;
  let moreThan100 = 0;
  let moreThan200 = 0;
  let singleParticipant = 0;

  const distribution = {
    '1-5': 0,
    '6-15': 0,
    '16-50': 0,
    '51-100': 0,
    '101-200': 0,
    '201-500': 0,
    '500+': 0
  };

  for (const session of sessions) {
    const nonSystem = session.filter(m => m.type !== 'system');
    const cnt = nonSystem.length;
    msgCounts.push(cnt);

    if (cnt < 5) lessThan5++;
    if (cnt < 10) lessThan10++;
    if (cnt > 100) moreThan100++;
    if (cnt > 200) moreThan200++;

    if (cnt <= 5) distribution['1-5']++;
    else if (cnt <= 15) distribution['6-15']++;
    else if (cnt <= 50) distribution['16-50']++;
    else if (cnt <= 100) distribution['51-100']++;
    else if (cnt <= 200) distribution['101-200']++;
    else if (cnt <= 500) distribution['201-500']++;
    else distribution['500+']++;

    const durationMs = session[session.length - 1].timestamp.getTime() - session[0].timestamp.getTime();
    const durationMin = Math.round((durationMs / 60000) * 10) / 10;
    durations.push(durationMin);

    const parts = new Set(nonSystem.map(m => m.sender).filter(Boolean));
    participantCounts.push(parts.size);
    if (parts.size <= 1) singleParticipant++;
  }

  msgCounts.sort((a, b) => a - b);
  durations.sort((a, b) => a - b);

  const totalMsgs = msgCounts.reduce((a, b) => a + b, 0);
  const avgMessagesPerSession = sessionCount > 0 ? Math.round((totalMsgs / sessionCount) * 10) / 10 : 0;
  const medianMessagesPerSession = percentile(msgCounts, 50);
  const minMessagesPerSession = msgCounts[0] || 0;
  const maxMessagesPerSession = msgCounts[msgCounts.length - 1] || 0;
  const stdDevMessagesPerSession = stdDev(msgCounts, avgMessagesPerSession);

  const totalDuration = durations.reduce((a, b) => a + b, 0);
  const avgSessionDurationMinutes = sessionCount > 0 ? Math.round((totalDuration / sessionCount) * 10) / 10 : 0;
  const medianSessionDurationMinutes = percentile(durations, 50);

  const totalParticipants = participantCounts.reduce((a, b) => a + b, 0);
  const avgParticipantsPerSession = sessionCount > 0 ? Math.round((totalParticipants / sessionCount) * 10) / 10 : 0;

  return {
    strategy,
    threshold,
    sessionCount,
    avgMessagesPerSession,
    medianMessagesPerSession,
    minMessagesPerSession,
    maxMessagesPerSession,
    stdDevMessagesPerSession,
    sessionsWithLessThan5Msgs: lessThan5,
    sessionsWithLessThan10Msgs: lessThan10,
    sessionsWithMoreThan100Msgs: moreThan100,
    sessionsWithMoreThan200Msgs: moreThan200,
    avgSessionDurationMinutes,
    medianSessionDurationMinutes,
    avgParticipantsPerSession,
    singleParticipantSessions: singleParticipant,
    distribution
  };
}

export function runAllSessionExperiments(messages: Message[]): SessionExperimentResult[] {
  const results: SessionExperimentResult[] = [];

  // Strategy 1: Inactivity Gap
  const gapThresholds = [5, 10, 15, 30, 60, 120, 240, 480];
  for (const gap of gapThresholds) {
    const sessions = segmentInactivityGap(messages, gap);
    results.push(evaluateSessionExperiment('Inactivity Gap', `${gap}min`, sessions));
  }

  // Strategy 2: Time-of-Day Aware
  const todThresholds = [30, 60];
  for (const gap of todThresholds) {
    const sessions = segmentTimeOfDayAware(messages, gap);
    results.push(evaluateSessionExperiment('Time-of-Day Aware', `${gap}min`, sessions));
  }

  // Strategy 3: Participant Shift
  const shiftSessions = segmentParticipantShift(messages, 30, 10);
  results.push(evaluateSessionExperiment('Participant Shift', '30min (N=10)', shiftSessions));

  return results;
}

export function computeProcessingTimeEstimates(
  experiment: SessionExperimentResult,
  realAvgTokensPerMessage: number
): ProcessingTimeEstimates {
  const inputTokensPerSession = 4000 + (experiment.avgMessagesPerSession * realAvgTokensPerMessage);
  const totalInputTokens = Math.round(experiment.sessionCount * inputTokensPerSession);
  const totalOutputTokens = experiment.sessionCount * 600;

  // Hardware configs
  const configs = [
    { name: 'RTX 4070 + 8B', prefill: 2500, decode: 65 },
    { name: 'RTX 3060 + 8B', prefill: 1200, decode: 40 },
    { name: 'CPU-only + 8B', prefill: 100, decode: 10 }
  ];

  const estimates = configs.map(cfg => {
    const prefillSec = totalInputTokens / cfg.prefill;
    const decodeSec = totalOutputTokens / cfg.decode;
    const rawTimeHours = Math.round(((prefillSec + decodeSec) / 3600) * 100) / 100;
    const optimizedTimeHours = Math.round((rawTimeHours * 0.3) * 100) / 100;
    return {
      hardware: cfg.name,
      rawTimeHours,
      optimizedTimeHours
    };
  });

  const cloudCost = Math.round(((totalInputTokens / 1000000 * 0.10) + (totalOutputTokens / 1000000 * 0.40)) * 100) / 100;
  const filterableSessionCount = experiment.sessionCount - experiment.sessionsWithLessThan5Msgs;

  return {
    strategy: experiment.strategy,
    threshold: experiment.threshold,
    realAvgTokensPerMessage,
    sessionCount: experiment.sessionCount,
    totalInputTokens,
    totalOutputTokens,
    estimates,
    cloudCost,
    filterableSessionCount
  };
}

export function getDetailedSessions(messages: Message[], strategy: string, thresholdStr: string): SessionDetail[] {
  let sessions: Message[][] = [];
  const gapNum = parseInt(thresholdStr.replace(/[^0-9]/g, ''), 10) || 30;

  if (strategy.toLowerCase().includes('time-of-day')) {
    sessions = segmentTimeOfDayAware(messages, gapNum);
  } else if (strategy.toLowerCase().includes('participant shift')) {
    sessions = segmentParticipantShift(messages, 30, 10);
  } else {
    sessions = segmentInactivityGap(messages, gapNum);
  }

  const avgTokensMsg = messages.length > 0 ? messages.reduce((a, b) => a + b.estimatedTokens, 0) / messages.length : 15;

  return sessions.map((sess, idx) => {
    const nonSys = sess.filter(m => m.type !== 'system');
    const startT = sess[0].timestamp;
    const endT = sess[sess.length - 1].timestamp;
    const durationMinutes = Math.round(((endT.getTime() - startT.getTime()) / 60000) * 10) / 10;
    const participants = Array.from(new Set(nonSys.map(m => m.sender).filter(Boolean)));

    const firstMsg = nonSys[0] ? `${nonSys[0].sender}: ${nonSys[0].content}` : sess[0].content;
    const lastMsg = nonSys[nonSys.length - 1] ? `${nonSys[nonSys.length - 1].sender}: ${nonSys[nonSys.length - 1].content}` : sess[sess.length - 1].content;

    const estimatedInputTokens = 4000 + Math.round(nonSys.length * avgTokensMsg);

    let noiseCount = 0;
    for (const msg of nonSys) {
      if (
        msg.shape === 'emoji_only' ||
        msg.shape === 'single_word' ||
        msg.shape === 'media_placeholder'
      ) {
        noiseCount++;
      }
    }
    const noiseRatio = nonSys.length > 0 ? Math.round((noiseCount / nonSys.length) * 100) / 100 : 0;

    return {
      id: idx + 1,
      startTime: startT.toISOString(),
      endTime: endT.toISOString(),
      durationMinutes,
      messageCount: nonSys.length,
      participants,
      firstMessagePreview: firstMsg.length > 80 ? firstMsg.substring(0, 80) + '...' : firstMsg,
      lastMessagePreview: lastMsg.length > 80 ? lastMsg.substring(0, 80) + '...' : lastMsg,
      estimatedInputTokens,
      noiseRatio
    };
  });
}
