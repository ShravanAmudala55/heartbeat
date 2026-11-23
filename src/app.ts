import Fastify from "fastify";
import sensible from "@fastify/sensible";
import type { Db } from "./db.js";
import { serviceRoutes } from "./routes/services.js";
import { incidentRoutes } from "./routes/incidents.js";
import { statusRoutes } from "./routes/status.js";
import { statusPageHtml } from "./status-page.js";

export async function buildApp(db: Db, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(sensible);

  app.get("/", async (_req, reply) => reply.type("text/html; charset=utf-8").send(statusPageHtml));
  app.get("/health", async () => ({ ok: true }));
  serviceRoutes(app, db);
  incidentRoutes(app, db);
  statusRoutes(app, db);

  return app;
}
