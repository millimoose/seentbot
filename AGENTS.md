# Agent Configuration Notes

## Proto and Tool Invocation

When executing code from a coding agent (like Forge), **always use `proto run <tool>`** rather than relying on tools being in PATH.

### Common Commands

Use `proto run bun --` to invoke bun through proto, then wrap with `direnv exec .` to load environment variables from `.envrc`:

```bash
# Lint (type-aware)
direnv exec . proto run bun -- bun run lint

# Typecheck
direnv exec . proto run bun -- bun run typecheck

# Test
direnv exec . proto run bun -- bun run test

# Dev server
direnv exec . proto run bun -- bun run dev
```

**Note:** Moon is installed but workspace is not yet configured. Tasks currently live in `package.json`.

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Language | TypeScript (strict mode) |
| ORM | Prisma 7 (SQLite via bun:sqlite) |
| Discord API | discord.js v14 |
| Image processing | sharp |
| Logging | LogTape |
| Testing | Bun test |
| Linting | oxlint (type-aware + type-check via tsgolint) |

## Key Behaviors

### URL Detection
- URLs are extracted from **Discord embeds only** (not raw message content)
- URLs are normalized: lowercase, strip `www`, strip tracking params (`utm_*`, `fbclid`, `ref`, `gclid`, etc.), force HTTPS
- Resolution follows redirects (HEAD request) to get final destination

### Image Duplicate Detection
- Images extracted from embed thumbnails/images and message attachments
- Uses **DCT-based pHash** algorithm: 32x32 resize → 2D DCT → 8x8 low-freq coefficients → binary hash
- Hash is 64-character binary string
- Similarity threshold: 85% (Hamming distance ≤ 10 of 64 bits)
- Fuzzy matching catches resized/cropped variants
- Processed via `sharp` library

### Message Handling
- Ignores bot messages
- Only processes messages with embeds OR attachments
- Creates reply thread on duplicates (60 min auto-archive)
- Handles `MessageExistingThread` error gracefully (replies to existing thread)

## Project Structure

```
src/
  bot.ts          # Discord client, event handlers, duplicate handlers
  types.ts        # TypeScript interfaces
  services/
    dedup.ts      # URL normalization, duplicate detection
    image-hash.ts # pHash computation, similarity
    storage.ts     # Prisma database operations
    logger.ts      # LogTape logger (debug level in dev, info in prod)
```

## Database

- Schema: `prisma/schema.prisma`
- Single table: `Message` (id, channelId, guildId, authorId, url, imageUrl, imageHash, timestamp, messageUrl)
- Indexes on `url`, `channelId`, `imageHash`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DISCORD_BOT_TOKEN` | Bot authentication (required) |
| `DATABASE_URL` | Database connection (default: `file:./dev.db`) |

Local dev uses SQLite. Production uses Postgres via Pulumi ESC.

## Development

```bash
proto run bun -- bun install              # Install dependencies
proto run bun -- bunx prisma generate    # Generate Prisma client
proto run bun -- bun run dev              # Run dev server
proto run bun -- bun test                 # Run tests
proto run bun -- bun run lint             # Type-aware linting
proto run bun -- bun run typecheck        # Typecheck
```

## Git Hooks (Lefthook)

- **pre-commit**: typecheck, lint (type-aware with auto-fix)
- **pre-push**: test
