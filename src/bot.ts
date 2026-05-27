import { Client, IntentsBitField, MessageFlags, type Message as DiscordMessage } from "discord.js";
import {
  extractEmbedUrls,
  extractEmbedImages,
  extractAttachmentImages,
  checkDuplicate,
  checkImageDuplicate,
  resolveUrl,
  processImage,
} from "./services/dedup.js";
import { saveMessage, initDatabase, closeDatabase } from "./services/storage.js";
import { configureSync, getConsoleSink, getLogger, getJsonLinesFormatter } from "@logtape/logtape";
import { getPrettyFormatter } from "@logtape/pretty";

// Logging configuration
// Defaults based on NODE_ENV, can be overridden with LOG_LEVEL and LOG_FORMAT
const isProduction = process.env.NODE_ENV === "production";
const logLevel = (process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug")) as "debug" | "info" | "warning" | "error" | "fatal" | "trace";
const logFormat = process.env.LOG_FORMAT ?? (isProduction ? "json" : "pretty");

const formatter = logFormat === "json" ? getJsonLinesFormatter() : getPrettyFormatter({ properties: true });

configureSync({
  sinks: {
    console: getConsoleSink({ formatter }),
  },
  filters: {
    minLevel: logLevel,
  },
  loggers: [
    {
      category: ["seentbot"],
      lowestLevel: logLevel,
      sinks: ["console"],
    },
  ],
});

const logger = getLogger("seentbot");

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

/**
 * Generates a Discord message jump link.
 */
function getMessageUrl(message: DiscordMessage): string {
  return `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
}

/**
 * Handles a duplicate URL by replying to the message.
 */
async function handleDuplicateUrl(
  message: DiscordMessage,
  url: string,
  originalMessageUrl: string
): Promise<void> {
  logger.info("Duplicate URL detected", { url, originalMessageUrl });
  const replyText = `I've already seen this link! Original: ${originalMessageUrl}`;
  await message.reply(replyText);
}

/**
 * Handles a duplicate image by replying to the message.
 */
async function handleDuplicateImage(
  message: DiscordMessage,
  imageUrl: string,
  originalMessageUrl: string,
  similarity: number
): Promise<void> {
  logger.info("Duplicate image detected", {
    imageUrl,
    similarity: similarity.toFixed(1) + "%",
    originalMessageUrl,
  });
  const replyText = `I've already seen this image! (${similarity.toFixed(1)}% similar) Original: ${originalMessageUrl}`;
  await message.reply(replyText);
}

/**
 * Handles a new message event.
 * Extracts URLs and images from embeds and attachments,
 * checks for duplicates, and either stores the message or
 * replies in a thread with the original link.
 */
async function handleMessage(message: DiscordMessage): Promise<void> {
  const MESSAGE_FLAG_FORWARDED = MessageFlags.HasSnapshot;

  // Guild filter: respond to all guilds (*), specific guild, or empty for no messages
  const guildIdFilter = process.env.GUILD_ID;
  if (guildIdFilter && guildIdFilter !== "*" && message.guildId !== guildIdFilter) {
    return;
  }

  logger.debug("Saw message", {
    id: message.id,
    type: message.type,
    embeds: message.embeds?.length ?? 0,
    attachments: message.attachments?.size ?? 0,
    flags: message.flags,
  });

  // Handle forwarded messages - extract original ID and use its embeds
  if (message.flags.has(MESSAGE_FLAG_FORWARDED)) {
    const rawMessage = message as unknown as Record<string, unknown>;
    const snapshots = rawMessage.messageSnapshots as { first: () => unknown } | undefined;
    
    const original = snapshots?.first() as DiscordMessage | undefined;
    
    if (original) {
      logger.info("Got forwarded original", {
        originalId: original.id,
        originalEmbeds: original.embeds.length,
      });
      // Extract embeds from original message
      const embedUrls = extractEmbedUrls(original.embeds);
      for (const detected of embedUrls) {
        const resolved = await resolveUrl(detected.url);
        const result = await checkDuplicate(resolved);
        if (result.isDuplicate && result.originalMessage) {
          await handleDuplicateUrl(message, resolved, result.originalMessage.messageUrl);
        }
      }
      // Extract images from original
      const embedImages = extractEmbedImages(original.embeds);
      for (const url of embedImages) {
        const detected = await processImage(url);
        if (detected?.hash) {
          const result = await checkImageDuplicate(detected.hash, message.guildId);
          if (result.isDuplicate && result.originalMessage) {
            await handleDuplicateImage(message, url, result.originalMessage.messageUrl, result.similarity ?? 0);
          }
        }
      }
    } else {
      logger.info("No original in snapshots");
    }
    return;
  }

  // Process the message
  await processMessage(message);
}

async function processMessage(message: DiscordMessage): Promise<void> {
  // Ignore messages without embeds or attachments
  const hasEmbeds = message.embeds && message.embeds.length > 0;
  const hasAttachments = message.attachments && message.attachments.size > 0;

  if (!hasEmbeds && !hasAttachments) {
    return;
  }

  // Extract and process URLs from embeds
  if (hasEmbeds) {
    const embedUrls = extractEmbedUrls(message.embeds);

    if (embedUrls.length === 0) {
      logger.debug("Has embeds but no URLs extracted");
    }

    for (const detected of embedUrls) {
      // Resolve URL across redirects
      const resolved = await resolveUrl(detected.url);

      // Log resolution
      if (resolved !== detected.url) {
        logger.debug("URL resolved", { from: detected.url, to: resolved });
      }

      // Check for duplicates
      const result = await checkDuplicate(resolved);

      if (result.isDuplicate && result.originalMessage) {
        await handleDuplicateUrl(message, resolved, result.originalMessage.messageUrl);
      } else if (message.author) {
        // First time seeing this URL - store it
        await saveMessage({
          id: message.id,
          channelId: message.channelId,
          guildId: message.guildId ?? null,
          authorId: message.author.id,
          url: resolved,
          timestamp: message.createdAt,
          messageUrl: getMessageUrl(message),
        });
      }
    }
  }

  // Extract and process images from embeds and attachments
  if (hasEmbeds || hasAttachments) {
    // Debug log all embeds
    for (const embed of message.embeds ?? []) {
      logger.debug("Embed", {
        type: (embed as unknown as { type?: string }).type,
        url: embed.url,
        image: embed.image?.url,
        thumbnail: embed.thumbnail?.url,
        video: embed.video?.url,
      });
    }

    // Debug log all attachments
    for (const attachment of message.attachments.values()) {
      logger.debug("Attachment", {
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
      });
    }

    const imageUrls: { url: string; source: string }[] = [];

    if (hasEmbeds) {
      const embedImages = extractEmbedImages(message.embeds);
      logger.debug("Extracted embed images", { count: embedImages.length, urls: embedImages });
      for (const url of embedImages) {
        imageUrls.push({ url, source: "embed" });
      }
    }

    if (hasAttachments) {
      const attachmentImages = extractAttachmentImages(message.attachments);
      logger.debug("Extracted attachment images", { count: attachmentImages.length, urls: attachmentImages });
      for (const url of attachmentImages) {
        imageUrls.push({ url, source: "attachment" });
      }
    }

    // Process each image
    if (imageUrls.length > 0) {
      logger.debug("Processing images", {
        count: imageUrls.length,
        sources: imageUrls.map((i) => i.source),
      });
    }

    for (const { url: imageUrl, source } of imageUrls) {
      const detected = await processImage(imageUrl);

      if (!detected || !detected.hash) {
        continue;
      }

      // Log image hash for testing
      logger.debug("Image hash computed", { source, hash: detected.hash });

      // Check for duplicates
      const result = await checkImageDuplicate(detected.hash, message.guildId);

      if (result.isDuplicate && result.originalMessage) {
        await handleDuplicateImage(
          message,
          imageUrl,
          result.originalMessage.messageUrl,
          result.similarity ?? 0
        );
      } else if (message.author) {
        // First time seeing this image - store it
        await saveMessage({
          id: message.id,
          channelId: message.channelId,
          guildId: message.guildId ?? null,
          authorId: message.author.id,
          imageUrl: detected.url,
          imageHash: detected.hash,
          timestamp: message.createdAt,
          messageUrl: getMessageUrl(message),
        });
      }
    }
  }
}

// Event handlers
client.on("messageCreate", handleMessage);

client.on("clientReady", async () => {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  logger.info("Seentbot started", { nodeEnv, user: client.user?.tag });

  // Initialize database connection
  await initDatabase();
  logger.info("Database connection established");
});

client.on("disconnect", async () => {
  await closeDatabase();
  logger.info("Database connection closed");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down");
  await closeDatabase();
  void client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down");
  await closeDatabase();
  void client.destroy();
  process.exit(0);
});

// Start the bot
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  logger.error("DISCORD_BOT_TOKEN environment variable is required");
  process.exit(1);
}

client.login(token).catch((error) => {
  logger.error("Failed to login", { error: String(error) });
  process.exit(1);
});

// Handle unhandled rejections
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});

export { client, handleMessage, getMessageUrl };