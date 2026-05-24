import { PrismaClient, type Message } from "@prisma/client";
import type { MessageData } from "../types.js";

const prisma = new PrismaClient();

/**
 * Saves a new message to the database with optional URL and image.
 * @param message - The message data to store
 */
export async function saveMessage(message: MessageData): Promise<Message> {
  return prisma.message.create({
    data: {
      id: message.id,
      channelId: message.channelId,
      guildId: message.guildId,
      authorId: message.authorId,
      url: message.url ?? null,
      imageUrl: message.imageUrl ?? null,
      imageHash: message.imageHash ?? null,
      timestamp: message.timestamp,
      messageUrl: message.messageUrl,
    },
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
 * Finds messages with similar image hashes for duplicate detection.
 * Returns candidates that might match (first 100 by timestamp).
 * @param hash - The image hash to search for
 * @param channelId - Optional channel ID to filter by
 * @returns Array of messages with image hashes
 */
export async function findByImageHash(
  hash: string,
  channelId?: string
): Promise<Message[]> {
  return prisma.message.findMany({
    where: {
      imageHash: {
        not: null,
      },
      ...(channelId && { channelId }),
    },
    orderBy: {
      timestamp: "desc",
    },
    take: 100,
  });
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