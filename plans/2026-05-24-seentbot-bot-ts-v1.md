// Seentbot - Discord client entry point
import { Client, GatewayIntentBits, Embed, TextChannel } from 'discord.js';
import { extractUrls, extractEmbedUrls, processMessage } from './services/dedup';
import type { DuplicateResult } from './types';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bots (including self)
  if (message.author.bot) return;

  // Ignore messages without content
  if (!message.content && (!message.embeds || message.embeds.length === 0)) return;

  // Extract URLs from content and embeds
  const contentUrls = extractUrls(message.content);
  const embedUrls = extractEmbedUrls(message.embeds as Embed[]);
  const allUrls = [...contentUrls, ...embedUrls];

  if (allUrls.length === 0) return;

  // Process message and check for duplicates
  const result = await processMessage(allUrls, {
    id: message.id,
    channelId: message.channelId,
    guildId: message.guildId ?? undefined,
    authorId: message.author.id,
    timestamp: message.createdAt,
    messageUrl: message.url,
  });

  // Reply if duplicate found
  if (result?.isDuplicate && result.originalMessage) {
    const original = result.originalMessage;
    const reply = `Duplicate detected! [Original message](<${original.messageUrl}>) was posted in <#${original.channelId}>`;

    await message.reply(reply);
  }
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await client.destroy();
  process.exit(0);
});

// Start the bot
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN not set');
  process.exit(1);
}

client.login(token);