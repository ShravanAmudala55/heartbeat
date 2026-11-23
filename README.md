<p align="center"><img src="assets/logo.svg" alt="Heartbeat logo" width="200"></p>

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
