import fs from 'fs';
import path from 'path';
import { parseWhatsAppExport } from './parser';
import {
  computeVolumeMetrics,
  computeTemporalMetrics,
  computeMemberMetrics,
  computeSocialMetrics,
  computeContentMetrics,
  computeMilestonesMetrics,
  computeTokenAndShapeMetrics,
  computeLanguageMetrics,
  computePipelineReadinessMetrics,
  computeComicSignalMetrics,
  computeMemorySignalMetrics,
  segmentByInactivityGap
} from './analytics';
import { runAllSessionExperiments, computeProcessingTimeEstimates } from './sessions';
import { BenchmarkReport } from './types';

export function generateBenchmarkReport(filePath: string): BenchmarkReport {
  const fileStats = fs.statSync(filePath);
  const parseRes = parseWhatsAppExport(filePath);
  const messages = parseRes.messages;
  const members = parseRes.members;

  const sessions30Min = segmentByInactivityGap(messages, 30);

  const volumeMetrics = computeVolumeMetrics(messages, members);
  const temporalMetrics = computeTemporalMetrics(messages);
  const memberMetrics = computeMemberMetrics(messages, members, sessions30Min);
  const socialMetrics = computeSocialMetrics(messages, members, sessions30Min);
  const contentMetrics = computeContentMetrics(messages);
  const milestones = computeMilestonesMetrics(messages);
  const tokenAndShapeMetrics = computeTokenAndShapeMetrics(messages, members);
  const languageMetrics = computeLanguageMetrics(messages, members);
  const pipelineReadiness = computePipelineReadinessMetrics(messages, sessions30Min);
  const comicSignals = computeComicSignalMetrics(messages, sessions30Min);
  const memorySignals = computeMemorySignalMetrics(messages, members, sessions30Min);

  const sessionExperiments = runAllSessionExperiments(messages);

  const rec30 = sessionExperiments.find(e => e.strategy === 'Inactivity Gap' && e.threshold === '30min') || sessionExperiments[0];
  const processingTimeEstimates = computeProcessingTimeEstimates(rec30, tokenAndShapeMetrics.avgTokensPerMessage);

  const durationDays = Math.round(
    ((parseRes.timespan.end.getTime() - parseRes.timespan.start.getTime()) / (1000 * 60 * 60 * 24)) * 10
  ) / 10;

  const report: BenchmarkReport = {
    metadata: {
      chatFile: path.basename(filePath),
      fileSize: `${Math.round((fileStats.size / (1024 * 1024)) * 100) / 100} MB`,
      totalLines: parseRes.totalLines,
      parsedAt: new Date().toISOString()
    },
    parseStats: {
      totalMessages: volumeMetrics.totalMessages,
      totalSystemMessages: volumeMetrics.totalSystemMessages,
      uniqueMembers: members.length,
      parseErrors: parseRes.parseErrors,
      multiLineMessages: parseRes.multiLineMessages,
      timespan: {
        start: parseRes.timespan.start.toISOString(),
        end: parseRes.timespan.end.toISOString()
      },
      durationDays
    },
    volumeMetrics,
    temporalMetrics,
    memberMetrics,
    socialMetrics,
    contentMetrics,
    milestones,
    tokenAndShapeMetrics,
    languageMetrics,
    pipelineReadiness,
    comicSignals,
    memorySignals,
    sessionExperiments,
    processingTimeEstimates
  };

  return report;
}

if (process.argv[1] && process.argv[1].endsWith('report.ts')) {
  const possiblePaths = [
    // benchmarks/chats/ (current, gitignored)
    path.resolve(__dirname, '../../../chats/WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt'),
    // benchmarks/chat-stats/data/ (legacy location)
    path.resolve(__dirname, '../../data/WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt'),
    // works when CWD is the repo root
    path.resolve('benchmarks/chats/WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt')
  ];
  const targetFile = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  const report = generateBenchmarkReport(targetFile);

  const jsonString = JSON.stringify(report, null, 2);
  const outputPath = path.resolve(__dirname, '../../report.json');
  fs.writeFileSync(outputPath, jsonString, 'utf8');

  if (process.argv.includes('--stdout')) {
    console.log(jsonString);
  } else {
    console.log(`Benchmark report generated successfully and saved to ${outputPath}`);
  }
}
