import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import type { Db } from "../src/db.js";

function fakeDb() {
  const services: any[] = [];
  const db = {
    service: {
      create: async ({ data }: any) => {
        if (services.some((s) => s.name === data.name)) throw Object.assign(new Error("dup"), { code: "P2002" });
        const s = { id: `id${services.length + 1}`, intervalSeconds: 60, active: true, createdAt: new Date(), ...data };
        services.push(s);
        return s;
      },
      findMany: async () => services,
      findUnique: async ({ where }: any) => services.find((s) => s.id === where.id) ?? null,
    },
  };
  return db as unknown as Db;
}

describe("API", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    app = await buildApp(fakeDb());
  });

  it("GET /health", async () => {
    const res = await app.inject({ url: "/health" });
    expect(res.statusCode).toBe(200);
  });

  it("creates and lists services", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/services",
      payload: { name: "Portfolio", url: "https://example.com" },
    });
    expect(created.statusCode).toBe(201);
    const list = await app.inject({ url: "/services" });
    expect(list.json()).toHaveLength(1);
  });

  it("rejects an invalid body", async () => {
    const res = await app.inject({ method: "POST", url: "/services", payload: { name: "x", url: "not-a-url" } });
    expect(res.statusCode).toBe(400);
  });

  it("returns 409 for a duplicate name", async () => {
    const payload = { name: "A", url: "https://a.com" };
    await app.inject({ method: "POST", url: "/services", payload });
    const res = await app.inject({ method: "POST", url: "/services", payload });
    expect(res.statusCode).toBe(409);
  });

  it("returns 404 for checks of an unknown service", async () => {
    const res = await app.inject({ url: "/services/nope/checks" });
    expect(res.statusCode).toBe(404);
  });
});
