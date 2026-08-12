import express from 'express';
import path from 'path';
import fs from 'fs';
import { generateBenchmarkReport } from './report';
import { parseWhatsAppExport } from './parser';
import { getDetailedSessions } from './sessions';

const app = express();
const PORT = process.env.PORT || 3000;

const chatFilePath = path.resolve('../data/WhatsApp Chat with आंतरिक मित्र मंडल (antarik).txt');

console.log('Parsing chat file and generating analytics report...');
const startT = Date.now();
const report = generateBenchmarkReport(chatFilePath);
const parsedData = parseWhatsAppExport(chatFilePath);
console.log(`Analytics computed in ${Date.now() - startT}ms.`);

// Serve static frontend files
app.use(express.static(path.resolve('public')));
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
