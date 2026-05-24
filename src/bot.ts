import { Client, IntentsBitField, type Message as DiscordMessage } from "discord.js";
import { extractUrls, extractEmbedUrls, checkDuplicate } from "./services/dedup.js";
import { saveMessage, initDatabase, closeDatabase } from "./services/storage.js";
import { normalizeUrl } from "./services/dedup.js";

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
 * Handles a new message event.
 * Extracts URLs from content and embeds, checks for duplicates,
 * and either stores the message or replies with the original link.
 */
async function handleMessage(message: DiscordMessage): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore messages without content
  if (!message.content && (!message.embeds || message.embeds.length === 0)) {
    return;
  }

  // Extract URLs from content and embeds
  const contentUrls = extractUrls(message.content);
  const embedUrls = extractEmbedUrls(message.embeds);
  const allUrls = [...contentUrls, ...embedUrls];

  if (allUrls.length === 0) return;

  // Process each URL
  for (const detected of allUrls) {
    const normalized = detected.url;

    // Check for duplicates
    const result = await checkDuplicate(normalized);

    if (result.isDuplicate && result.originalMessage) {
      // Found a duplicate - reply with the original message link
      await message.reply(
        `I've already seen this link! Check it out here: ${result.originalMessage.messageUrl}`
      );
    } else {
      // First time seeing this URL - store it
      await saveMessage({
        id: message.id,
        channelId: message.channelId,
        guildId: message.guildId ?? null,
        authorId: message.author.id,
        url: normalized,
        timestamp: message.createdAt,
        messageUrl: getMessageUrl(message),
      });
    }
  }
}

// Event handlers
client.on("messageCreate", handleMessage);

client.on("ready", async () => {
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