# seentbot

A Discord bot that calls out reposts. It watches messages in a guild and replies when someone posts a link or image that has already been shared.

## How it works

- **URL detection** — URLs are extracted from message **embeds** (not raw message content), normalized (lowercased, `www` stripped, tracking parameters such as `utm_*`, `fbclid`, `ref`, `gclid` removed, HTTPS forced), and resolved through redirects to their final destination.
- **Image detection** — images from embed thumbnails/images and message attachments are fingerprinted with a DCT-based perceptual hash (32×32 resize → 2D DCT → 8×8 low-frequency coefficients → 64-bit binary hash). Hashes are compared with a similarity threshold of 85% (Hamming distance ≤ 10), so resized or slightly cropped variants are still caught.
- **Replies** — on a duplicate, the bot replies with a jump link to the original message (URLs) or the similarity percentage and original (images). URL duplicates get a reply thread that auto-archives after 60 minutes; if a thread already exists, the bot replies there instead of failing. Bot messages are ignored; only messages with embeds or attachments are processed.

## Requirements

- [Bun](https://bun.sh) ≥ 1.0
- A Discord bot token (Discord Developer Portal) with the `Guilds`, `GuildMessages`, and `MessageContent` intents enabled
- SQLite for local development (default, no setup needed) or PostgreSQL for production

## Setup

```bash
proto run bun -- bun install
proto run bun -- bunx prisma generate
```

> This repo uses [proto](https://moonrepo.dev/proto) to manage toolchain versions. If you don't use proto, run the commands directly with `bun` instead.

Configure environment variables (see `.envrc.example`, or use [direnv](https://direnv.net/)):

| Variable | Purpose |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Bot authentication (required) |
| `DATABASE_URL` | Database connection (default: `file:./dev.db`) |
| `GUILD_ID` | Restrict to one guild ID; `*` for all guilds; unset = ignore everything (safety default) |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` (defaults from `NODE_ENV`) |
| `LOG_FORMAT` | `pretty` or `json` (defaults: pretty in dev, json in production) |

## Running

```bash
# Development (watch mode)
proto run bun -- bun run dev

# Production (applies schema, then starts)
proto run bun -- bun run start
```

For local PostgreSQL testing:

```bash
docker compose up -d
```

Production uses PostgreSQL with credentials supplied via [Pulumi ESC](https://www.pulumi.com/product/pulumi-esc/).

## Development

```bash
proto run bun -- bun run typecheck   # TypeScript
proto run bun -- bun run lint       # oxlint (type-aware)
proto run bun -- bun test           # Bun test
```

Pre-commit hooks (typecheck + lint) and pre-push hooks (tests) run via [Lefthook](https://lefthook.dev).

## Project structure

```
src/
  bot.ts           # Discord client, event and duplicate handlers
  types.ts         # Shared interfaces
  services/
    dedup.ts       # URL normalization, duplicate detection
    image-hash.ts  # pHash computation, similarity
    storage.ts     # Prisma database operations
    logger.ts      # LogTape logger setup
prisma/
  schema.prisma    # Message model (url, image hash, channel/guild/author, links)
tests/             # Bun tests for dedup logic
```

## License

[MIT](LICENSE)
