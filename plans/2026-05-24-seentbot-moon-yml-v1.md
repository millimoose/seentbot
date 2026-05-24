# moon workspace configuration
# https://moonrepo.dev/docs/config/workspace

extends:
  - //typescript

projects:
  seentbot:
    type: website
    language: typescript
    dependencies:
      - "@types/node"
    tasks:
      dev:
        command: tsx src/bot.ts
        platform: system
      typecheck:
        command: tsc --noEmit
      lint:
        command: oxlint
      test:
        command: vitest run
      studio:
        command: prisma studio