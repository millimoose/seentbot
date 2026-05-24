# Seentbot MVP - Implementation Plan

## Objective

Build a minimal Discord bot that detects duplicate posts by URL in messages.

---

## MVP Scope

| Feature | Included |
|---------|----------|
| URL detection (message content + Discord link embeds) | Yes |
| Perceptual image hashing | No (Stage 2) |
| PostgreSQL storage | No (Stage 3) |
| Cloud deployment (Exoscale) | No (Stage 4) |
| Replies with original link | Yes |

---

## Project Structure

```
seentbot/
├── src/
│   ├── bot.ts                 # Discord client
│   ├── services/
│   │   ├── dedup.ts           # URL duplicate detection
│   │   └── storage.ts         # Database operations (Prisma)
│   └── types.ts               # TypeScript interfaces
├── prisma/
│   └── schema.prisma           # Prisma schema
├── tests/
│   └── dedup.test.ts
├── docker-compose.yml          # PostgreSQL for later
├── .tool-versions             # proto version pins
├── moon.yml
├── lefthook.yml
├── .envrc                     # direnv + Pulumi ESC
├── package.json
└── tsconfig.json
```

---

## Implementation Tasks

### Phase 1: Project Setup

- [ ] Create GitHub repo: `gh repo create millimoose/seentbot --private`
- [ ] Initialize TypeScript project with `pnpm init`
- [ ] Configure `.tool-versions` (bun, node, moon)
- [ ] Set up `moon.yml` workspace
- [ ] Configure `lefthook.yml` (typecheck + lint on pre-commit)
- [ ] Add Prisma: `pnpm add prisma @prisma/client && npx prisma init`

### Phase 2: Core Bot (MVP)

- [ ] Define Prisma schema with SQLite provider
- [ ] Generate Prisma client
- [ ] Implement `storage.ts` - save/find URLs via Prisma
- [ ] Implement `dedup.ts` - extract URLs, normalize, check dups
- [ ] Create `bot.ts` - Discord client, message handler
- [ ] Reply to duplicate with link to original message
- [ ] Run `prisma studio` to verify admin UI works

### Phase 3: Environment

- [ ] Create `millimoose/seentbot/dev` in Pulumi ESC (Discord token)
- [ ] Configure `.envrc` with `esc run`
- [ ] Document `.env` fallback

### Phase 4: Testing

- [ ] Write unit tests for URL normalization
- [ ] Write unit tests for dedup logic
- [ ] Manual test in Discord with ngrok

---

## Verification Criteria

- Bot connects to Discord Gateway
- URL in message content is detected
- URL in Discord link embed is detected
- Duplicate detection works across channels
- Bot replies with link to original message
- SQLite persists data across restarts
- `npx prisma studio` opens admin UI

---

## Future Stages (Roadmap)

### Stage 2: Dockerized PostgreSQL

```yaml
# docker-compose.yml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: seentbot
    POSTGRES_USER: seentbot
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

- Update Prisma provider from `sqlite` to `postgresql`
- Add Exoscale DBaaS connection string to Pulumi ESC
- Run `prisma migrate dev` to migrate schema

### Stage 3: Perceptual Image Hashing

- Add `sharp` dependency for image processing
- Implement pHash algorithm
- Store image hashes alongside URLs
- Detect near-duplicate images (>85% similarity)

### Stage 4: Cloud Deployment (Exoscale)

- Create SKS cluster via Pulumi
- Build Docker image, push to registry
- Deploy to Kubernetes with ESO sync from ESC
- Configure health checks and restart policies

### Stage 5: Advanced Features

- Slash commands for admin configuration
- Per-guild settings (threshold, actions)
- Metrics and monitoring
- Automated cleanup of old records

---

## Stack Summary

| Layer | MVP | Later |
|-------|-----|-------|
| Language | TypeScript | - |
| Runtime | proto (bun) | - |
| Build | moon | - |
| Linter | oxlint | ESLint fallback |
| Hooks | lefthook | - |
| Discord | discord.js v14 | - |
| ORM | Prisma | - |
| Database | SQLite | PostgreSQL (Exoscale) |
| Admin | Prisma Studio | - |
| Env | Pulumi ESC | - |

---

## Configuration Files (see corresponding plan files)

| Plan File | Configuration |
|-----------|---------------|
| `seentbot-tool-versions-v1.md` | `.tool-versions` |
| `seentbot-moon-yml-v1.md` | `moon.yml` |
| `seentbot-lefthook-yml-v1.md` | `lefthook.yml` |
| `seentbot-prisma-schema-v1.md` | `prisma/schema.prisma` |
| `seentbot-tsconfig-json-v1.md` | `tsconfig.json` |
| `seentbot-vitest-config-v1.md` | `vitest.config.ts` |
| `seentbot-env-example-v1.md` | `.env.example` |
| `seentbot-types-ts-v1.md` | `src/types.ts` |
| `seentbot-storage-ts-v1.md` | `src/services/storage.ts` |
| `seentbot-dedup-ts-v1.md` | `src/services/dedup.ts` |
| `seentbot-bot-ts-v1.md` | `src/bot.ts` |
| `seentbot-dedup-test-v1.md` | `tests/dedup.test.ts` |