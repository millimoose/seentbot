import { Client, IntentsBitField, type Message as DiscordMessage } from "discord.js";
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
import { logger } from "./services/logger.js";

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
  ],
});

/**
 * Generates a Discord message jump link.
 */
function getMessageUrl(message: DiscordMessage): string {
  return `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
}

/**
 * Handles a duplicate URL by replying in a thread.
 */
async function handleDuplicateUrl(
  message: DiscordMessage,
  url: string,
  originalMessageUrl: string
): Promise<void> {
  logger.info(`Duplicate URL detected: ${url} (original: ${originalMessageUrl})`);

  const threadName = `Duplicate: ${url.substring(0, 50)}`;
  const replyText = `I've already seen this link! Original: ${originalMessageUrl}`;

  if (message.hasThread) {
    await message.thread?.send(replyText);
  } else {
    const thread = await message.startThread({
      name: threadName,
      autoArchiveDuration: 60,
    });
    await thread.send(replyText);
  }
}

/**
 * Handles a duplicate image by replying in a thread.
 */
async function handleDuplicateImage(
  message: DiscordMessage,
  imageUrl: string,
  originalMessageUrl: string,
  similarity: number
): Promise<void> {
  logger.info(
    `Duplicate image detected: ${imageUrl} ~ ${similarity.toFixed(1)}% (original: ${originalMessageUrl})`
  );

  const threadName = `Duplicate Image`;
  const replyText = `I've already seen this image! (${similarity.toFixed(1)}% similar) Original: ${originalMessageUrl}`;

  if (message.hasThread) {
    await message.thread?.send(replyText);
  } else {
    const thread = await message.startThread({
      name: threadName,
      autoArchiveDuration: 60,
    });
    await thread.send(replyText);
  }
}

/**
 * Handles a new message event.
 * Extracts URLs and images from embeds and attachments,
 * checks for duplicates, and either stores the message or
 * replies in a thread with the original link.
 */
async function handleMessage(message: DiscordMessage): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore messages without embeds or attachments
  const hasEmbeds = message.embeds && message.embeds.length > 0;
  const hasAttachments = message.attachments && message.attachments.size > 0;

  if (!hasEmbeds && !hasAttachments) {
    return;
  }

  // Extract and process URLs from embeds
  if (hasEmbeds) {
    const embedUrls = extractEmbedUrls(message.embeds);

    for (const detected of embedUrls) {
      // Resolve URL across redirects
      const resolved = await resolveUrl(detected.url);

      // Log resolution
      if (resolved !== detected.url) {
        logger.debug(`URL resolved: ${detected.url} -> ${resolved}`);
      }

      // Check for duplicates
      const result = await checkDuplicate(resolved);

      if (result.isDuplicate && result.originalMessage) {
        await handleDuplicateUrl(message, resolved, result.originalMessage.messageUrl);
      } else {
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
    const imageUrls: string[] = [];

    if (hasEmbeds) {
      imageUrls.push(...extractEmbedImages(message.embeds));
    }

    if (hasAttachments) {
      imageUrls.push(...extractAttachmentImages(message.attachments));
    }

    // Process each image
    for (const imageUrl of imageUrls) {
      const detected = await processImage(imageUrl);

      if (!detected || !detected.hash) {
        continue;
      }

      // Check for duplicates
      const result = await checkImageDuplicate(detected.hash);

      if (result.isDuplicate && result.originalMessage) {
        await handleDuplicateImage(
          message,
          imageUrl,
          result.originalMessage.messageUrl,
          result.similarity ?? 0
        );
      } else {
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
  console.log(`Logged in as ${client.user?.tag}`);

  // Initialize database connection
  await initDatabase();
  console.log("Database connection established");
});

client.on("disconnect", async () => {
  await closeDatabase();
  console.log("Database connection closed");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await closeDatabase();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await closeDatabase();
  client.destroy();
  process.exit(0);
});

// Start the bot
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error("DISCORD_BOT_TOKEN environment variable is required");
  process.exit(1);
}

client.login(token).catch((error) => {
  console.error("Failed to login:", error);
  process.exit(1);
});

// Handle unhandled rejections
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

export { client, handleMessage, getMessageUrl };