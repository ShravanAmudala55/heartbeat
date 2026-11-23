import type { FastifyInstance } from "fastify";
import type { Db } from "../db.js";

export function serviceRoutes(app: FastifyInstance, db: Db) {
  app.post<{ Body: { name: string; url: string; intervalSeconds?: number } }>(
    "/services",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "url"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            url: { type: "string", format: "uri", pattern: "^https?://" },
            intervalSeconds: { type: "integer", minimum: 10, maximum: 86400 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const service = await db.service.create({ data: req.body });
        return reply.code(201).send(service);
      } catch (err: any) {
        if (err?.code === "P2002") throw app.httpErrors.conflict("Service name already exists");
        throw err;
      }
    },
  );

  app.get("/services", async () => db.service.findMany({ orderBy: { createdAt: "asc" } }));

  app.get<{ Params: { id: string }; Querystring: { limit?: number; cursor?: string } }>(
    "/services/:id/checks",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            cursor: { type: "string" },
          },
        },
      },
    },
    async (req) => {
      const { id } = req.params;
      const limit = req.query.limit ?? 50;
      const service = await db.service.findUnique({ where: { id } });
      if (!service) throw app.httpErrors.notFound("Service not found");

      const rows = await db.check.findMany({
        where: { serviceId: id },
        orderBy: { checkedAt: "desc" },
        take: limit + 1,
        ...(req.query.cursor ? { cursor: { id: req.query.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
    },
  );

  app.delete<{ Params: { id: string } }>("/services/:id", async (req, reply) => {
    try {
      await db.service.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    } catch (err: any) {
      if (err?.code === "P2025") throw app.httpErrors.notFound("Service not found");
      throw err;
    }
  });
}
