<p align="center"><img src="assets/logo.svg" alt="Heartbeat logo" width="200"></p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="Fastify" src="https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node%2Ejs-339933?style=for-the-badge&logo=nodedotjs&logoColor=white">
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white">
</p>

# Heartbeat

A small service-health monitor. Register URLs, and it pings them on a schedule,
stores every result, tracks uptime, and opens/resolves incidents automatically.

**Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Vitest.

## How it works

```
POST /services ──> Service (Postgres)
                        │
   scheduler (every 10s) ──> due services ──> ping URL ──> Check row
                                                        │
                    3 failures in a row ──> Incident (auto)
                    next success        ──> Incident auto-resolved
```

## Run it

```bash
docker compose up -d          # Postgres
npm install
npx prisma migrate dev --name init
npm run dev                   # http://localhost:3000
npm test
```

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/services` | Register `{ name, url, intervalSeconds? }` |
| GET | `/services` | List services |
| DELETE | `/services/:id` | Remove a service |
| GET | `/services/:id/checks?limit=&cursor=` | Paginated check history |
| POST | `/incidents` | Manually open an incident |
| GET | `/incidents?open=true` | List incidents |
| PATCH | `/incidents/:id/resolve` | Resolve an incident |
| GET | `/status` | Per-service status, 24h uptime %, open incidents |
| GET | `/health` | Liveness |

## Design notes

- `buildApp(db)` takes the Prisma client as a parameter, so tests run without a database.
- Request bodies are validated with Fastify's JSON schemas.
- Check history uses cursor pagination (stable under constant inserts).
- Incident logic lives in `src/checker.ts` (`recordCheck`) and is unit tested.

## Ideas to extend

Status page front end, webhook/Slack alerts on incident open, retention job for old checks, deploy to Railway/Render/Fly.
