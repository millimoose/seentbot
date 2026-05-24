import { findByUrl } from "./storage.js";
import type { DetectedUrl, DuplicateResult, ExtractableEmbeds } from "../types.js";

/**
 * Regular expression to match URLs in text content.
 * Matches http/https URLs with optional www prefix.
 */
const URL_REGEX = /https?:\/\/(?:www\.)?[^\s<>"{}|\\^`[\]]+/gi;

/**
 * List of tracking parameters to strip from URLs.
 */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_reader",
  "utm_sourceid",
  "utm_cid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "ref",
  "fbclid",
  "gclid",
  "msclkid",
  "dclid",
  "twclid",
  "igshid",
];

/**
 * Extracts URLs from message content text.
 * @param content - The message text content
 * @returns Array of detected URLs with original and normalized forms
 */
export function extractUrls(content: string): DetectedUrl[] {
  if (!content) return [];

  const matches = content.match(URL_REGEX);
  if (!matches) return [];

  return matches.map((url) => ({
    url: normalizeUrl(url),
    original: url,
  }));
}

/**
 * Extracts URLs from Discord message embeds.
 * Specifically looks for link embeds with URL fields.
 * @param embeds - Array of embeds from a Discord message
 * @returns Array of detected URLs from embeds
 */
export function extractEmbedUrls(embeds: ExtractableEmbeds): DetectedUrl[] {
  if (!embeds || embeds.length === 0) return [];

  const urls: DetectedUrl[] = [];

  for (const embed of embeds) {
    // Check for embeds that have URLs (link, video, article types)
    if (embed.url) {
      urls.push({
        url: normalizeUrl(embed.url),
        original: embed.url,
      });
    }
  }

  return urls;
}

/**
 * Normalizes a URL by:
 * - Converting to lowercase
 * - Removing www prefix
 * - Removing trailing slashes
 * - Stripping tracking parameters (utm_*, ref, fbclid, etc.)
 * - Converting http to https
 * @param url - The original URL string
 * @returns The normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Convert http to https
    parsed.protocol = "https:";

    // Remove www prefix
    let host = parsed.hostname;
    if (host.startsWith("www.")) {
      host = host.substring(4);
    }
    parsed.hostname = host;

    // Remove trailing slash
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

    // Remove tracking parameters
    const params = Array.from(parsed.searchParams.keys());
    for (const param of params) {
      if (TRACKING_PARAMS.includes(param.toLowerCase())) {
        parsed.searchParams.delete(param);
      }
    }

    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is with basic cleanup
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * Checks if a URL has been posted before.
 * @param url - The normalized URL to check
 * @param channelId - Optional channel ID to limit search scope
 * @returns DuplicateResult indicating if a duplicate was found
 */
export async function checkDuplicate(
  url: string,
  channelId?: string
): Promise<DuplicateResult> {
  const existing = await findByUrl(url, channelId);

  if (existing) {
    return {
      isDuplicate: true,
      originalMessage: existing,
    };
  }

  return { isDuplicate: false };
}