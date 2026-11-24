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

**Live status page: https://heartbeat-wamx.onrender.com**

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
docker compose up -d          # Postgres (or point DATABASE_URL at any Postgres)
cp .env.example .env
npm install
npx prisma migrate deploy     # applies the committed migration
npm run dev                   # http://localhost:3000  (status page at /)
npm test
npm run typecheck
```

## API

Reads are public. **Writes (POST, PATCH, DELETE) need an `x-api-key` header** matching the `API_KEY` env var; without it the server answers 401, and 503 if no key is configured.

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
| GET | `/` | Retro status page (auto-refreshing) |
| GET | `/health` | Liveness |

```bash
curl -X POST https://<your-host>/services \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"name":"Portfolio","url":"https://example.com","intervalSeconds":300}'
```

## Deploy (Render + Neon, free)

1. Create a Neon Postgres database and copy its connection string.
2. `DATABASE_URL="<neon url>" npx prisma migrate deploy`
3. Render web service from this repo. Build: `npm install && npx prisma generate && npm run build`. Start: `npm start`. Health check: `/health`.
4. Environment variables: `DATABASE_URL`, `API_KEY` (long random string), `NODE_VERSION=22`.
5. Point a free external pinger (UptimeRobot, cron-job.org) at `/health` every 5 minutes so the free instance does not sleep.

## Security notes

- Write endpoints require the API key (compared in constant time).
- Monitored URLs must be http(s) and resolve to public addresses only: loopback, private ranges, link-local and cloud-metadata addresses are rejected when a service is added and again on every check.
- Redirects are reported, not followed, so a public URL cannot bounce a check to an internal address.
- Known limit: DNS is resolved once for the guard and again when connecting, so a hostile DNS server could in theory change its answer in between.

## Design notes

- `buildApp(db)` takes the Prisma client as a parameter, so tests run without a database.
- Request bodies are validated with Fastify's JSON schemas.
- Check history uses cursor pagination (stable under constant inserts).
- Incident logic lives in `src/checker.ts` (`recordCheck`) and is unit tested.

## Ideas to extend

Webhook/Slack alerts on incident open, retention job for old checks, deploy to Railway/Render/Fly.
