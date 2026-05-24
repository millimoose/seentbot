{
  "name": "seentbot",
  "version": "0.1.0",
  "description": "Discord bot that detects duplicate posts by URL",
  "type": "module",
  "scripts": {
    "dev": "tsx src/bot.ts",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint",
    "test": "vitest run",
    "studio": "prisma studio",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^6.x",
    "discord.js": "^14.x"
  },
  "devDependencies": {
    "@types/node": "^22.x",
    "oxlint": "^0.x",
    "prisma": "^6.x",
    "tsx": "^4.x",
    "typescript": "^5.x",
    "vitest": "^2.x"
  }
}