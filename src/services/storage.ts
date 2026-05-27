import { PrismaClient, type Message } from "../generated/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { typeid } from "typeid-js";
import type { MessageData } from "../types.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Generate a TypeID for index entries.
 */
function generateIndexId(): string {
  return typeid("idx").toString();
}

/**
 * Build index entries for image hash lookup.
 * Creates 17 entries: exact hash (distance=0) + 16 prefixes (distance=1).
 */
function buildHashIndexEntries(hash: string): { hashPrefix: string; hashPosition: number; distance: number }[] {
  const entries: { hashPrefix: string; hashPosition: number; distance: number }[] = [];

  // Exact match entry
  entries.push({
    hashPrefix: hash,
    hashPosition: -1,
    distance: 0,
  });

  // Prefix entries - one char replaced by '*'
  for (let i = 0; i < hash.length; i++) {
    entries.push({
      hashPrefix: hash.substring(0, i) + "*" + hash.substring(i + 1),
      hashPosition: i,
      distance: 1,
    });
  }

  return entries;
}

/**
 * Saves a new message to the database with optional URL and image.
 * Also creates redundant index entries for image hash lookup.
 * @param message - The message data to store
 */
export async function saveMessage(message: MessageData): Promise<Message> {
  const indexEntries = message.imageHash
    ? buildHashIndexEntries(message.imageHash).map((entry) => ({
        id: generateIndexId(),
        hashPrefix: entry.hashPrefix,
        hashPosition: entry.hashPosition,
      }))
    : [];

  return prisma.message.upsert({
    where: { id: message.id },
    create: {
      id: message.id,
      channelId: message.channelId,
      guildId: message.guildId,
      authorId: message.authorId,
      url: message.url ?? null,
      imageUrl: message.imageUrl ?? null,
      imageHash: message.imageHash ?? null,
      timestamp: message.timestamp,
      messageUrl: message.messageUrl,
      imageIndex: {
        create: indexEntries,
      },
    },
    update: {},
  });
}

/**
 * Finds the first message that contains the given normalized URL.
 * Optionally filters by channel.
 * @param url - The normalized URL to search for
 * @param channelId - Optional channel ID to filter by
 * @returns The matching message or null if not found
 */
export async function findByUrl(
  url: string,
  channelId?: string
): Promise<Message | null> {
  return prisma.message.findFirst({
    where: {
      url,
      ...(channelId && { channelId }),
    },
    orderBy: {
      timestamp: "asc",
    },
  });
}

/**
 * Finds the most recent message with a similar image hash for duplicate detection.
 * Uses the redundant prefix index for efficient lookup.
 * Currently returns just the latest match, but the structure supports
 * returning all matches or implementing other strategies later.
 * @param hash - The image hash to search for (16 hex chars)
 * @param guildId - Guild ID to search within
 * @returns The most recent matching message, or null if none found
 */
export async function findByImageHash(
  hash: string,
  guildId: string | null
): Promise<Message | null> {
  // Build prefix queries - hash with each position replaced by '*'
  const prefixQueries = buildHashIndexEntries(hash).map(
    (entry) => entry.hashPrefix
  );

  // Query the index
  const indexEntries = await prisma.imageHashIndex.findMany({
    where: {
      hashPrefix: { in: prefixQueries },
      message: {
        guildId: guildId,
      },
    },
    include: {
      message: true,
    },
    take: 100,
  });

  // Find the most recent message
  let latest: Message | null = null;
  for (const entry of indexEntries) {
    if (!latest || entry.message.timestamp > latest.timestamp) {
      latest = entry.message;
    }
  }

  return latest;
}

/**
 * Initializes the database connection.
 * Call this at application startup.
 */
export async function initDatabase(): Promise<void> {
  await prisma.$connect();
}

/**
 * Closes the database connection.
 * Call this at application shutdown.
 */
export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
export type { Message };