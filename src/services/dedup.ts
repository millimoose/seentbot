import { findByUrl, findByImageHash } from "./storage.js";
import type { DetectedUrl, DuplicateResult, ExtractableEmbeds, ExtractableAttachments, DetectedImage, ImageDuplicateResult } from "../types.js";
import { downloadImage, computeImageHash, hashSimilarity } from "./image-hash.js";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("seentbot");

/**
 * Resolve a URL following redirects to get the final destination.
 * Uses HEAD request with redirects followed automatically.
 */
export async function resolveUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent": "Seentbot/1.0 (Discord bot)",
      },
      signal: AbortSignal.timeout(5000),
    });

    return response.url;
  } catch {
    return url;
  }
}

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
 * Extracts image URLs from Discord message embeds.
 * Looks at thumbnail.url and image.url fields.
 * @param embeds - Array of embeds from a Discord message
 * @returns Array of detected image URLs
 */
export function extractEmbedImages(embeds: ExtractableEmbeds): string[] {
  if (!embeds || embeds.length === 0) return [];

  const imageUrls: string[] = [];

  for (const embed of embeds) {
    // Check thumbnail
    if (embed.thumbnail?.url) {
      imageUrls.push(embed.thumbnail.url);
      logger.debug("Found image in embed thumbnail", { url: embed.thumbnail.url });
    }
    // Check main image
    if (embed.image?.url) {
      imageUrls.push(embed.image.url);
      logger.debug("Found image in embed", { url: embed.image.url });
    }
  }

  return imageUrls;
}

/**
 * Extracts image URLs from Discord message attachments.
 * Filters for common image MIME types.
 * @param attachments - Array of attachments from a Discord message
 * @returns Array of detected image URLs
 */
export function extractAttachmentImages(attachments: ExtractableAttachments): string[] {
  if (!attachments || attachments.size === 0) return [];

  const imageUrls: string[] = [];
  const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  for (const attachment of attachments.values()) {
    if (imageTypes.includes(attachment.contentType ?? "")) {
      imageUrls.push(attachment.url);
      logger.debug("Found image in attachment", { url: attachment.url });
    }
  }

  return imageUrls;
}

/**
 * Process an image URL: download, compute hash.
 * @param imageUrl - URL of the image
 * @returns DetectedImage with URL and hash, or null if failed
 */
export async function processImage(imageUrl: string): Promise<DetectedImage | null> {
  const buffer = await downloadImage(imageUrl);
  if (!buffer) return null;

  const hash = await computeImageHash(buffer);
  if (!hash) return null;

  return {
    url: imageUrl,
    hash,
  };
}

/**
 * Checks if an image has been posted before using perceptual hash.
 * @param hash - The image hash to check
 * @param guildId - Guild to search within
 * @param threshold - Minimum similarity percentage (default 85%)
 * @returns ImageDuplicateResult indicating if a duplicate was found
 */
export async function checkImageDuplicate(
  hash: string,
  guildId: string | null,
  threshold = 85
): Promise<ImageDuplicateResult> {
  const candidate = await findByImageHash(hash, guildId);

  if (!candidate || !candidate.imageHash) {
    return { isDuplicate: false };
  }

  const similarity = hashSimilarity(hash, candidate.imageHash);

  if (similarity >= threshold) {
    return {
      isDuplicate: true,
      originalMessage: {
        id: candidate.id,
        channelId: candidate.channelId,
        guildId: candidate.guildId,
        authorId: candidate.authorId,
        url: candidate.url,
        imageUrl: candidate.imageUrl,
        imageHash: candidate.imageHash,
        timestamp: candidate.timestamp,
        messageUrl: candidate.messageUrl,
      },
      similarity,
    };
  }

  return { isDuplicate: false };
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