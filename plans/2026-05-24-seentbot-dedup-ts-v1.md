// URL duplicate detection logic
import type { DetectedUrl, DuplicateResult, Message } from '../types';
import { findByUrl, saveMessage } from './storage';

// URL normalization patterns
const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const WWW_PATTERN = /^https?:\/\/www\./i;
const TRAILING_SLASH_PATTERN = /\/+$/;

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Normalize www
    parsed.hostname = parsed.hostname.replace(WWW_PATTERN, 'https://');

    // Remove tracking params
    TRACKING_PARAMS.forEach((param) => parsed.searchParams.delete(param));

    // Remove empty fragments
    parsed.hash = '';

    // Normalize trailing slash (except for root)
    const path = parsed.pathname.replace(TRAILING_SLASH_PATTERN, '') || '/';
    parsed.pathname = path;

    return parsed.toString();
  } catch {
    return url;
  }
}

export function extractUrls(content: string): DetectedUrl[] {
  const urlRegex = /https?:\/\/[^\s<>\[\]]+/gi;
  const matches = content.match(urlRegex) || [];

  return matches.map((url) => ({
    url: normalizeUrl(url),
    original: url,
  }));
}

export function extractEmbedUrls(embeds: Array<{ url?: string }>): DetectedUrl[] {
  return embeds
    .filter((embed) => embed.url)
    .map((embed) => ({
      url: normalizeUrl(embed.url!),
      original: embed.url!,
    }));
}

export async function checkDuplicate(url: string): Promise<DuplicateResult> {
  const existing = await findByUrl(url);

  if (existing) {
    return {
      isDuplicate: true,
      originalMessage: existing,
    };
  }

  return { isDuplicate: false };
}

export async function processMessage(
  urls: DetectedUrl[],
  message: {
    id: string;
    channelId: string;
    guildId?: string;
    authorId: string;
    timestamp: Date;
    messageUrl: string;
  }
): Promise<DuplicateResult | null> {
  for (const detected of urls) {
    const result = await checkDuplicate(detected.url);

    if (result.isDuplicate && result.originalMessage) {
      return result;
    }

    // Save non-duplicate URLs for future detection
    await saveMessage(detected.url, message);
  }

  return null;
}