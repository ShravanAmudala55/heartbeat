import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Require the `x-api-key` header on every write request. Reads stay public. */
export function requireApiKeyForWrites(app: FastifyInstance, apiKey: string | undefined) {
  app.addHook("onRequest", async (req) => {
    if (!WRITE_METHODS.has(req.method)) return;
    if (!apiKey) throw app.httpErrors.serviceUnavailable("API_KEY is not configured on the server");
    const given = req.headers["x-api-key"];
    if (typeof given !== "string" || !safeEqual(given, apiKey)) {
      throw app.httpErrors.unauthorized("Missing or invalid x-api-key");
    }
  });
}
