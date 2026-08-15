import express from 'express';
import path from 'path';
import fs from 'fs';
import { generateBenchmarkReport } from './report';
import { parseWhatsAppExport } from './parser';
import { getDetailedSessions } from './sessions';

const app = express();
const PORT = process.env.PORT || 3000;

const possibleChatPaths = [
  // benchmarks/chats/ (current, gitignored)
  path.resolve(__dirname, '../../../chats/WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt'),
  // benchmarks/chat-stats/data/ (legacy location)
  path.resolve(__dirname, '../../data/WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt'),
  // works when CWD is the repo root
  path.resolve('benchmarks/chats/WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt')
];
const chatFilePath = possibleChatPaths.find(p => fs.existsSync(p)) || possibleChatPaths[0];

console.log(`Parsing chat file from ${chatFilePath} and generating analytics report...`);
const startT = Date.now();
const report = generateBenchmarkReport(chatFilePath);
const parsedData = parseWhatsAppExport(chatFilePath);
console.log(`Analytics computed in ${Date.now() - startT}ms.`);

// Serve static frontend files
app.use(express.static(path.resolve(__dirname, '../public')));
app.use(express.json());

// API Endpoints
app.get('/api/parse-info', (req, res) => {
  res.json({
    metadata: report.metadata,
    parseStats: report.parseStats
  });
});

app.get('/api/analytics', (req, res) => {
  res.json({
    volumeMetrics: report.volumeMetrics,
    temporalMetrics: report.temporalMetrics,
    memberMetrics: report.memberMetrics,
    socialMetrics: report.socialMetrics,
    contentMetrics: report.contentMetrics,
    milestones: report.milestones,
    tokenAndShapeMetrics: report.tokenAndShapeMetrics,
    languageMetrics: report.languageMetrics
  });
});

app.get('/api/pipeline', (req, res) => {
  res.json(report.pipelineReadiness);
});

app.get('/api/comic-signals', (req, res) => {
  res.json(report.comicSignals);
});

app.get('/api/memory-signals', (req, res) => {
  res.json(report.memorySignals);
});

app.get('/api/sessions', (req, res) => {
  res.json({
    experiments: report.sessionExperiments,
    estimates: report.processingTimeEstimates
  });
});

app.get('/api/sessions/:strategy/:threshold', (req, res) => {
  const { strategy, threshold } = req.params;
  const decodedStrategy = decodeURIComponent(strategy);
  const decodedThreshold = decodeURIComponent(threshold);

  const sessions = getDetailedSessions(parsedData.messages, decodedStrategy, decodedThreshold);
  res.json({
    strategy: decodedStrategy,
    threshold: decodedThreshold,
    totalSessions: sessions.length,
    sessions
  });
});

app.get('/api/report', (req, res) => {
  res.json(report);
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`Yapbook Chat Benchmark Web Server running at:`);
  console.log(`http://localhost:${PORT}`);
  console.log(`=================================================`);
});
