import fs from 'fs';
import { Message, ParseResult } from './types';

const HINGLISH_WORDS = new Set([
  'bhai', 'haan', 'nahi', 'nhi', 'hai', 'ho', 'h', 'kr', 'kar', 'rha', 'rhe', 'rhi',
  'kya', 'ko', 'se', 'me', 'mein', 'ka', 'ki', 'ke', 'ye', 'yeh', 'wo', 'woh',
  'wale', 'wala', 'wali', 'accha', 'achha', 'bas', 'mat', 'kal', 'aaj', 'ab', 'abe',
  'abey', 'chal', 'yar', 'yaar', 'tu', 'tum', 'aap', 'hum', 'tere', 'mera', 'meri',
  'mere', 'sab', 'bta', 'btao', 'dekh', 'sun', 'log', 'toh', 'to', 'bol', 'bata',
  'baki', 'bhot', 'bahot', 'bahut', 'waise', 'fir', 'phir', 'pta', 'pata', 'bro', 'chhod', 'gaya', 'gayi', 'gaye'
]);

export function parseDateTime(dateStr: string, timeStr: string): Date {
  const [dStr, mStr, yStr] = dateStr.split('/');
  const day = parseInt(dStr, 10);
  const month = parseInt(mStr, 10) - 1;
  let year = parseInt(yStr, 10);
  if (year < 100) year += 2000;

  const cleanedTime = timeStr.replace(/[\u202F\u8239\u00A0\s]+/g, ' ').trim().toLowerCase();
  const timeMatch = cleanedTime.match(/^(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?$/i);
  let hour = 0;
  let minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
    const meridiem = timeMatch[3];
    if (meridiem) {
      if (meridiem.startsWith('p') && hour < 12) hour += 12;
      else if (meridiem.startsWith('a') && hour === 12) hour = 0;
    }
  }
  return new Date(Date.UTC(year, month, day, hour, minute));
}

export function extractMentions(text: string): string[] {
  const matches: string[] = [];
  const regex = /@[\u2066-\u2069]?([^\u2066-\u2069@\n,!\?]+)[\u2066-\u2069]?/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const name = m[1].replace(/[\u2066-\u2069]/g, '').trim();
    if (name && name !== 'AI' && name !== 'Meta AI') {
      matches.push(name);
    } else if (name === 'Meta AI') {
      matches.push(name);
    }
  }
  return matches;
}

export function detectLanguage(content: string): 'en' | 'hi' | 'hinglish' | 'other' {
  const devanagariCount = (content.match(/[\u0900-\u097F]/g) || []).length;
  const latinCount = (content.match(/[a-zA-Z]/g) || []).length;
  const totalAlpha = devanagariCount + latinCount;
  if (totalAlpha === 0) return 'other';
  if (devanagariCount / totalAlpha > 0.5) return 'hi';

  const words = content.toLowerCase().split(/\s+/);
  const hasHinglishWord = words.some(w => HINGLISH_WORDS.has(w.replace(/[^a-z]/g, '')));
  if (hasHinglishWord || (devanagariCount > 0 && latinCount > 0)) return 'hinglish';
  if (latinCount / totalAlpha > 0.9) return 'en';
  return 'other';
}

export function getEmojiCount(content: string): number {
  const matches = content.match(/\p{Extended_Pictographic}/gu);
  return matches ? matches.length : 0;
}

export function getMessageShape(
  content: string,
  type: Message['type'],
  wordCount: number,
  emojiCount: number
): Message['shape'] {
  if (type === 'media_omitted' || type === 'deleted') {
    return 'media_placeholder';
  }
  const cleanWithoutEmoji = content.replace(/\p{Extended_Pictographic}/gu, '').trim();
  if (emojiCount > 0 && cleanWithoutEmoji.length === 0) {
    return 'emoji_only';
  }
  if (wordCount <= 1) return 'single_word';
  if (wordCount <= 5) return 'short';
  if (wordCount <= 20) return 'medium';
  return 'long';
}

export function parseWhatsAppExport(filePath: string): ParseResult {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n');

  // Match line format: DD/MM/YY, H:MM am/pm - Sender: Message or System
  const msgRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?:[\u202F\s]*[ap]\.?m\.?)?)\s+-\s+(.*)$/i;

  const rawMessages: { timestamp: Date; rest: string }[] = [];
  let parseErrors = 0;
  let multiLineMessages = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.charCodeAt(0) === 0xFEFF) {
      // BOM trim
    }
    const trimmedLine = line.replace(/\r$/, '');
    if (!trimmedLine.trim() && i === lines.length - 1) continue;

    const match = trimmedLine.match(msgRegex);
    if (match) {
      const dateStr = match[1];
      const timeStr = match[2];
      const rest = match[3];
      const timestamp = parseDateTime(dateStr, timeStr);
      rawMessages.push({ timestamp, rest });
    } else {
      if (rawMessages.length > 0) {
        rawMessages[rawMessages.length - 1].rest += '\n' + trimmedLine;
        multiLineMessages++;
      } else {
        parseErrors++;
      }
    }
  }

  const messages: Message[] = [];
  const membersSet = new Set<string>();
  let systemMessagesCount = 0;
  let mediaOmittedCount = 0;
  let deletedMessagesCount = 0;

  for (let idx = 0; idx < rawMessages.length; idx++) {
    const raw = rawMessages[idx];
    const rest = raw.rest;
    const colonIdx = rest.indexOf(': ');

    let sender = '';
    let content = rest;
    let isSystem = false;

    if (colonIdx !== -1) {
      const candidateSender = rest.substring(0, colonIdx);
      // Check if candidateSender contains system keywords like "created group"
      if (
        candidateSender.includes('created group') ||
        candidateSender.includes('changed') ||
        candidateSender.includes('added')
      ) {
        isSystem = true;
        sender = '';
        content = rest;
      } else {
        sender = candidateSender.trim();
        content = rest.substring(colonIdx + 2);
        membersSet.add(sender);
      }
    } else {
      isSystem = true;
      sender = '';
      content = rest;
    }

    let type: Message['type'] = 'text';
    if (isSystem) {
      type = 'system';
      systemMessagesCount++;
    } else if (content.trim() === '<Media omitted>') {
      type = 'media_omitted';
      mediaOmittedCount++;
    } else if (
      content.includes('This message was deleted') ||
      content.includes('You deleted this message')
    ) {
      type = 'deleted';
      deletedMessagesCount++;
    } else if (/https?:\/\/\S+/i.test(content)) {
      type = 'link';
    }

    const charCount = content.length;
    const words = content.trim() ? content.trim().split(/\s+/) : [];
    const wordCount = words.length;
    const estimatedTokens = Math.round((charCount / 4) * 10) / 10;
    const emojiCount = getEmojiCount(content);
    const shape = getMessageShape(content, type, wordCount, emojiCount);
    const language = detectLanguage(content);
    const hasUrl = /https?:\/\/\S+/i.test(content);
    const mentionedNames = extractMentions(content);
    const hasMention = mentionedNames.length > 0;

    messages.push({
      id: idx,
      timestamp: raw.timestamp,
      sender,
      content,
      type,
      charCount,
      wordCount,
      estimatedTokens,
      emojiCount,
      shape,
      language,
      hasUrl,
      hasMention,
      mentionedNames
    });
  }

  const start = messages.length > 0 ? messages[0].timestamp : new Date();
  const end = messages.length > 0 ? messages[messages.length - 1].timestamp : new Date();

  return {
    messages,
    members: Array.from(membersSet),
    parseErrors,
    multiLineMessages,
    systemMessagesCount,
    mediaOmittedCount,
    deletedMessagesCount,
    timespan: { start, end },
    totalLines: lines.length
  };
}
