// Database operations via Prisma
import { PrismaClient } from '@prisma/client';
import type { Message } from '../types';

const prisma = new PrismaClient();

export async function saveMessage(
  url: string,
  message: {
    id: string;
    channelId: string;
    guildId?: string;
    authorId: string;
    timestamp: Date;
    messageUrl: string;
  }
): Promise<void> {
  await prisma.message.create({
    data: {
      id: message.id,
      channelId: message.channelId,
      guildId: message.guildId,
      authorId: message.authorId,
      url,
      timestamp: message.timestamp,
      messageUrl: message.messageUrl,
    },
  });
}

export async function findByUrl(
  url: string,
  channelId?: string
): Promise<Message | null> {
  const where = channelId
    ? { url, channelId }
    : { url };

  return prisma.message.findFirst({
    where,
    orderBy: { timestamp: 'asc' },
  });
}

export async function close(): Promise<void> {
  await prisma.$disconnect();
}