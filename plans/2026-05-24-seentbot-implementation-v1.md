# Seentbot Implementation Plan

## Overview

Discord bot that detects duplicate posts via URL matching. Replies to duplicates with a link to the original message.

---

## MVP Scope

| Feature | Status |
|---------|--------|
| URL detection (content + embeds) | Done |
| Perceptual image hashing | Stage 3 |
| PostgreSQL | Stage 2 |
| Cloud deployment (Exoscale) | Stage 4 |

---

## Project Structure

```
seentbot/
├── src/
│   ├── bot.ts                 # Discord client
│   ├── services/
│   │   ├── dedup.ts           # URL detection/normalization
│   │   └── storage.ts         # Prisma database ops
│   └── types.ts
├── prisma/schema.prisma
├── tests/dedup.test.ts
├── moon.yml
├── lefthook.yml
├── .envrc                     # Loads ESC
├── .envrc.example             # Documents all vars
└── .gitignore
```

---

## Environment Configuration

### Pulumi ESC First

All shareable configuration lives in **Pulumi ESC** (`millimoose/seentbot/dev`):
- `DISCORD_BOT_TOKEN`
- `DATABASE_URL` (for PostgreSQL later)

### Local `.envrc`

```bash
# Load Pulumi ESC environment
eval "$(esc run --env millimoose/seentbot/dev --print-dotenv)"

# Local overrides (commented examples)
# DATABASE_URL=file:./dev.db
```

### Creating ESC Environment

```bash
esc env init millimoose/seentbot/dev
esc env set millimoose/seentbot/dev DISCORD_BOT_TOKEN your_token
```

---

## Implementation Tasks

### Phase 1: Project Setup ✅

- [x] Create GitHub repo
- [x] Initialize TypeScript + Bun
- [x] Configure moon, lefthook
- [x] Setup Prisma with SQLite

### Phase 2: Core Bot ✅

- [x] Implement URL extraction (content + embeds)
- [x] URL normalization (strip tracking params)
- [x] Duplicate detection via Prisma
- [x] Reply to duplicate with original link
- [x] Unit tests (19 passing)

### Phase 3: Environment ✅

- [x] Configure `.envrc` for Pulumi ESC
- [x] Create `.envrc.example` documentation
- [x] Remove redundant `.env` files

---

## Verification

- [x] Bot connects to Discord Gateway
- [x] URL in message content detected
- [x] URL in Discord link embed detected
- [x] Duplicate detection works
- [x] Bot replies with original link
- [x] SQLite persists across restarts

---

## Future Stages

### Stage 2: Dockerized PostgreSQL

- Add `docker-compose.yml` with PostgreSQL
- Update Prisma provider to `postgresql`
- Add `DATABASE_URL` to ESC
- Run `prisma migrate`

### Stage 3: Perceptual Image Hashing

- Add `sharp` for image processing
- Implement pHash algorithm
- Store image hashes alongside URLs
- Detect >85% similar images

### Stage 4: Exoscale Deployment

- Create SKS cluster via Pulumi
- Build Docker image, push to registry
- Deploy to Kubernetes with ESO
- Configure health checks

---

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| Tasks | moon |
| Hooks | lefthook |
| Discord | discord.js v14 |
| ORM | Prisma |
| Database | SQLite → PostgreSQL |
| Env | Pulumi ESC |