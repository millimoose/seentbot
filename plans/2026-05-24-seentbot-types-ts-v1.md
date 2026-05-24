// TypeScript type definitions for Seentbot

export interface DetectedUrl {
  url: string;           // Normalized URL
  original: string;     // Original URL as it appeared
}

export interface DuplicateResult {
  isDuplicate: boolean;
  originalMessage?: Message;
}

export interface Message {
  id: string;
  channelId: string;
  guildId: string | null;
  authorId: string;
  url: string;
  timestamp: Date;
  messageUrl: string;
}

export interface BotConfig {
  token: string;
  intents: number;
}

export interface DedupConfig {
  checkAcrossChannels: boolean;
  minUrlLength: number;
}