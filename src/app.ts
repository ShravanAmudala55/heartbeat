import Fastify from "fastify";
import sensible from "@fastify/sensible";
import type { Db } from "./db.js";
import { requireApiKeyForWrites } from "./auth.js";
import { assertPublicUrl, type UrlGuard } from "./netguard.js";
import { serviceRoutes } from "./routes/services.js";
import { incidentRoutes } from "./routes/incidents.js";
import { statusRoutes } from "./routes/status.js";
import { statusPageHtml } from "./status-page.js";

export interface AppOptions {
  logger?: boolean;
  /** Secret required in the `x-api-key` header for POST/PATCH/DELETE. */
  apiKey?: string;
  /** Decides which URLs may be monitored. Defaults to public internet only. */
  urlGuard?: UrlGuard;
}

export async function buildApp(db: Db, opts: AppOptions = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(sensible);
  requireApiKeyForWrites(app, opts.apiKey);

  app.get("/", async (_req, reply) => reply.type("text/html; charset=utf-8").send(statusPageHtml));
  app.get("/health", async () => ({ ok: true }));
  serviceRoutes(app, db, opts.urlGuard ?? assertPublicUrl);
  incidentRoutes(app, db);
  statusRoutes(app, db);

  return app;
}
