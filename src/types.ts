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
 * A detected image from Discord embeds or attachments.
 */
export interface DetectedImage {
  url: string;
  hash: string | null;
}

/**
 * Result of checking an image for duplicates.
 */
export interface ImageDuplicateResult {
  isDuplicate: boolean;
  originalMessage?: Message;
  similarity?: number;
}

/**
 * Represents a stored message record in the database.
 */
export interface Message {
  id: string;
  channelId: string;
  guildId: string | null;
  authorId: string;
  url: string | null;
  imageUrl: string | null;
  imageHash: string | null;
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
  url?: string | null;
  imageUrl?: string | null;
  imageHash?: string | null;
  timestamp: Date;
  messageUrl: string;
}

/**
 * Discord embed structure for URL and image extraction.
 */
export interface EmbedData {
  type: string;
  url?: string;
  title?: string;
  thumbnail?: {
    url?: string;
  };
  image?: {
    url?: string;
  };
}

/**
 * Helper type for extracting embeds from a Discord message.
 */
export type ExtractableEmbeds = Pick<DiscordMessage, "embeds">["embeds"];

/**
 * Helper type for extracting attachments from a Discord message.
 */
export type ExtractableAttachments = Pick<DiscordMessage, "attachments">["attachments"];