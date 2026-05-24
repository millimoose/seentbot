import type { Message as DiscordMessage, Embed } from "discord.js";

/**
 * A URL detected in a Discord message, with both the original
 * and normalized forms.
 */
export interface DetectedUrl {
  url: string;
  original: string;
}

/**
 * Result of checking a URL for duplicates.
 * If isDuplicate is true, originalMessage contains the first message.
 */
export interface DuplicateResult {
  isDuplicate: boolean;
  originalMessage?: Message;
}

/**
 * Represents a stored message record in the database.
 */
export interface Message {
  id: string;
  channelId: string;
  guildId: string | null;
  authorId: string;
  url: string;
  timestamp: Date;
  messageUrl: string;
}

/**
 * Data required to store a new message record.
 */
export interface MessageData {
  id: string;
  channelId: string;
  guildId: string | null;
  authorId: string;
  url: string;
  timestamp: Date;
  messageUrl: string;
}

/**
 * Discord embed structure for URL extraction.
 */
export interface EmbedData {
  type: string;
  url?: string;
  title?: string;
}

/**
 * Helper type for extracting embeds from a Discord message.
 */
export type ExtractableEmbeds = Pick<DiscordMessage, "embeds">["embeds"];