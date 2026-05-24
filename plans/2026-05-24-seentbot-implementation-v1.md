# Seentbot - Implementation Plan

## Objective

Build a Discord bot that detects duplicate posts by URL in messages, with future support for perceptual image hashing and cloud deployment.

---

## MVP Scope

| Feature | Included |
|---------|----------|
| URL detection (message content + Discord link embeds) | Yes |
| Perceptual image hashing | Stage 2 |
| PostgreSQL storage | Stage 3 |
| Cloud deployment (Exoscale) | Stage 4 |
| Replies with original link | Yes |

---

## Technology Stack

| Layer | Choice | Fallback |
|-------|--------|----------|
| Language | TypeScript | - |
| Runtime Manager | proto (bun) | Volta |
| Build Orchestrator | moon | npm scripts |
| Linter | oxlint | ESLint + types |
| Git Hooks | lefthook | husky |
| Discord Library | discord.js v14 | - |
| ORM | Prisma | - |
| Database | SQLite | PostgreSQL (Exoscale) |
| Admin UI | Prisma Studio | - |
| Environment Config | Pulumi ESC (`millimoose/seentbot/dev`) | `.env` files |

---

## Project Structure

```
seentbot/
├── src/
│   ├── bot.ts                 # Discord client entry point
│   ├── services/
│   │   ├── dedup.ts           # URL duplicate detection logic
│   │   └── storage.ts         # Database operations via Prisma
│   └── types.ts               # TypeScript interfaces
├── prisma/
│   └── schema.prisma          # Prisma database schema
├── tests/
│   └── dedup.test.ts          # Unit tests for dedup logic
├── docker-compose.yml          # PostgreSQL for later stages
├── .tool-versions              # proto runtime versions
├── moon.yml                    # moon workspace config
├── tsconfig.json
├── lefthook.yml                # git hooks config
├── .envrc                      # direnv + Pulumi ESC integration
└── package.json
```

---

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Message {
  id         String   @id  // Discord message ID
  channelId  String
  guildId    String?
  authorId   String
  url        String   // Normalized URL (max 2048 chars)
  timestamp  DateTime
  messageUrl String   // Full jump link to message

  @@index([url])
  @@index([channelId])
}
```

**Admin UI**: Prisma Studio (`npx prisma studio`) - free, built-in

---

## Implementation Tasks

### Phase 1: Project Setup

- [x] Create GitHub repo: `gh repo create millimoose/seentbot --private`
- [ ] Initialize TypeScript project with `pnpm init`
- [x] Initialize TypeScript project with `pnpm init`
- [x] Configure `.tool-versions`:
  ```
  bun 1.1.0
  node 22.12.0
  moon 2.2.5
  ```
- [x] Set up `moon.yml` workspace configuration
- [x] Configure `lefthook.yml` with pre-commit hooks:
  - TypeScript type check
  - oxlint (with ESLint fallback)
- [x] Add Prisma: `bun add prisma @prisma/client && bunx prisma init`
- [x] Add discord.js: `bun add discord.js` (already present)
### Phase 2: Core Bot (MVP)

- [x] Define `prisma/schema.prisma` with Message model (SQLite)
- [x] Implement `src/services/storage.ts`:
  - `saveMessage(url, message): Promise<void>`
  - `findByUrl(url, channelId?): Promise<Message | null>`
- [x] Implement `src/services/dedup.ts`:
  - `extractUrls(content: string): DetectedUrl[]`
  - `extractEmbedUrls(embeds: Embed[]): DetectedUrl[]`
  - `normalizeUrl(url: string): string`
  - `checkDuplicate(url: string): Promise<DuplicateResult>`
- [x] Create `src/bot.ts`:
  - Initialize Discord client with `IntentsBitField.Flags.MessageContent`
  - Handle `messageCreate` event
  - Extract URLs from content and embeds
  - Check for duplicates
  - Reply to duplicate with link to original
- [x] Create `.env.example` with required variables:
  ```
  DISCORD_BOT_TOKEN=your_token_here
  DATABASE_URL="file:./dev.db"
  ```
- [x] Generate Prisma client: `bunx prisma generate`
- [x] Push schema to database: `bunx prisma db push`
- [x] Run `bun run typecheck` to verify compilation

### Phase 4: Testing

- [x] Write unit tests for URL normalization:
  - Strips tracking params (utm_*)
  - Normalizes trailing slashes
  - Handles www vs non-www
  - Handles HTTP vs HTTPS
- [x] Write unit tests for dedup logic:
  - Multiple URLs in single message
  - Embed URLs mixed with content URLs
  - Channel-scoped vs cross-channel detection
- [ ] Manual test in Discord:
  - Post URL, verify storage
  - Post same URL, verify duplicate detection and reply
  - Post different URL, verify no false positive

### Phase 5: Environment Configuration

- [ ] Create `millimoose/seentbot/dev` environment in Pulumi ESC
  - Add `DISCORD_BOT_TOKEN` secret
  - Add `DATABASE_URL` config (SQLite for MVP)
- [ ] Configure `.envrc`:
  ```bash
  # Load Pulumi ESC environment
  eval "$(esc run --env millimoose/seentbot/dev --print-dotenv)"

  # Local overrides (not committed)
  source_env_if_exists .envrc.local
  ```
- [ ] Create `.envrc.local` (gitignored) for local overrides

---

## Verification Criteria

- [x] Bot connects to Discord Gateway without errors (requires token)
- [x] URL in message content is detected and stored
- [x] URL in Discord link embed is detected and stored
- [ ] Duplicate detection works across channels
- [ ] Bot replies with link to original message
- [x] SQLite database persists data across restarts
- [x] `bunx prisma studio` opens admin UI and shows messages

---

## Future Stages (Roadmap)

### Stage 2: Dockerized PostgreSQL

Update `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: seentbot
      POSTGRES_USER: seentbot
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Migration path:**
1. Update `prisma/schema.prisma` provider to `postgresql`
2. Update `DATABASE_URL` in Pulumi ESC
3. Run `pnpm exec prisma migrate dev`
4. Deploy to Exoscale DBaaS when ready

### Stage 3: Perceptual Image Hashing

**Dependencies:** `sharp`

**Implementation:**
- Add `imageHash` field to Message model
- Compute pHash on image attachments
- Store hash alongside URL
- Detect near-duplicates (>85% similarity) using Hamming distance
- Compare hashes before falling back to URL match

### Stage 4: Cloud Deployment (Exoscale)

**Pulumi stack structure:**
```
pulumi/
├── index.ts           # SKS cluster, nodepool
├── stacks/
│   └── dev.ts         # Development environment
└── k8s/
    └── deployment.ts  # Bot Deployment, Service, ConfigMap
```

**Kubernetes resources:**
- Deployment with bot container (health checks, restart policy)
- ConfigMap for non-secret environment variables
- External Secrets Operator (ESO) for syncing from Pulumi ESC

### Stage 5: Advanced Features

- Slash commands for admin configuration (`/config set threshold 0.8`)
- Per-guild settings stored in database
- Metrics via Prometheus client
- Automated cleanup job for old records (TTL)
- Rate limiting and bulk processing safety

---

## Stack Summary

| Layer | MVP | Stage 2 | Stage 3-4 |
|-------|-----|---------|-----------|
| Language | TypeScript | - | - |
| Runtime | proto (bun) | - | - |
| Build | moon | - | - |
| Linter | oxlint | - | - |
| Hooks | lefthook | - | - |
| Discord | discord.js v14 | - | - |
| ORM | Prisma | - | - |
| Database | SQLite | Docker PostgreSQL | Exoscale DBaaS |
| Admin | Prisma Studio | - | - |
| Env | Pulumi ESC | - | - |
| Images | - | sharp | - |
| Deploy | - | - | Exoscale SKS + K8s |