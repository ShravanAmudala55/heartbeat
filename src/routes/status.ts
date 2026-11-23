import type { FastifyInstance } from "fastify";
import type { Db } from "../db.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function statusRoutes(app: FastifyInstance, db: Db) {
  app.get("/status", async () => {
    const since = new Date(Date.now() - WINDOW_MS);
    const services = await db.service.findMany({
      orderBy: { name: "asc" },
      include: {
        checks: { orderBy: { checkedAt: "desc" }, take: 1 },
        incidents: { where: { resolvedAt: null }, select: { id: true } },
      },
    });

    return Promise.all(
      services.map(async (s) => {
        const [total, up] = await Promise.all([
          db.check.count({ where: { serviceId: s.id, checkedAt: { gte: since } } }),
          db.check.count({ where: { serviceId: s.id, checkedAt: { gte: since }, ok: true } }),
        ]);
        const last = s.checks[0];
        return {
          id: s.id,
          name: s.name,
          url: s.url,
          status: !last ? "unknown" : last.ok ? "up" : "down",
          lastCheckedAt: last?.checkedAt ?? null,
          lastResponseTimeMs: last?.responseTimeMs ?? null,
          uptime24hPercent: total === 0 ? null : Math.round((up / total) * 10000) / 100,
          openIncidents: s.incidents.length,
        };
      }),
    );
  });
}
