import type { FastifyInstance } from "fastify";
import type { Db } from "../db.js";

export function incidentRoutes(app: FastifyInstance, db: Db) {
  app.post<{ Body: { serviceId: string; title: string; notes?: string } }>(
    "/incidents",
    {
      schema: {
        body: {
          type: "object",
          required: ["serviceId", "title"],
          additionalProperties: false,
          properties: {
            serviceId: { type: "string" },
            title: { type: "string", minLength: 1, maxLength: 200 },
            notes: { type: "string", maxLength: 2000 },
          },
        },
      },
    },
    async (req, reply) => {
      const service = await db.service.findUnique({ where: { id: req.body.serviceId } });
      if (!service) throw app.httpErrors.notFound("Service not found");
      const incident = await db.incident.create({ data: req.body });
      return reply.code(201).send(incident);
    },
  );

  app.get<{ Querystring: { open?: boolean } }>(
    "/incidents",
    { schema: { querystring: { type: "object", properties: { open: { type: "boolean" } } } } },
    async (req) =>
      db.incident.findMany({
        where: req.query.open ? { resolvedAt: null } : {},
        orderBy: { startedAt: "desc" },
      }),
  );

  app.patch<{ Params: { id: string } }>("/incidents/:id/resolve", async (req) => {
    const incident = await db.incident.findUnique({ where: { id: req.params.id } });
    if (!incident) throw app.httpErrors.notFound("Incident not found");
    if (incident.resolvedAt) throw app.httpErrors.conflict("Incident already resolved");
    return db.incident.update({ where: { id: incident.id }, data: { resolvedAt: new Date() } });
  });
}
