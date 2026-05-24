import { Client, IntentsBitField, type Message as DiscordMessage } from "discord.js";
import { extractEmbedUrls, checkDuplicate, resolveUrl } from "./services/dedup.js";
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
 * Handles a new message event.
 * Extracts URLs from content and embeds, resolves redirects,
 * checks for duplicates, and either stores the message or
 * replies in a thread with the original link.
 */
async function handleMessage(message: DiscordMessage): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore messages without embeds
  if (!message.embeds || message.embeds.length === 0) {
    return;
  }

  // Extract URLs from embeds
  const embedUrls = extractEmbedUrls(message.embeds);

  // Log what we found
  for (const { original } of embedUrls) {
    logger.debug(`URL found in embed: ${original}`);
  }

  if (embedUrls.length === 0) return;

  // Process each URL
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
      // Found a duplicate - reply in a thread
      logger.info(`Duplicate URL detected: ${resolved} (original: ${result.originalMessage.messageUrl})`);

      // Check if message already has a thread
      if (message.hasThread) {
        await message.thread?.send(
          `I've already seen this link! Original: ${result.originalMessage.messageUrl}`
        );
      } else {
        const threadName = `Duplicate: ${detected.original.substring(0, 50)}`;
        const thread = await message.startThread({
          name: threadName,
          autoArchiveDuration: 60,
        });
        await thread.send(
          `I've already seen this link! Original: ${result.originalMessage.messageUrl}`
        );
      }
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