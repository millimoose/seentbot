// Prisma schema for Seentbot
// https://www.prisma.io/docs

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Message {
  id         String   @id // Discord message ID
  channelId  String
  guildId    String?
  authorId   String
  url        String   // Normalized URL
  timestamp  DateTime
  messageUrl String   // Full jump link to message

  @@index([url])
  @@index([channelId])
  @@index([guildId])
}