import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import type { Db } from "../src/db.js";
import { allowAnyUrl } from "../src/netguard.js";

const KEY = "test-key";
const auth = { "x-api-key": KEY };

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
    app = await buildApp(fakeDb(), { apiKey: KEY, urlGuard: allowAnyUrl });
  });

  it("GET /health", async () => {
    const res = await app.inject({ url: "/health" });
    expect(res.statusCode).toBe(200);
  });

  it("serves the status page at /", async () => {
    const res = await app.inject({ url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("heartbeat");
  });

  it("creates and lists services", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/services",
      headers: auth,
      payload: { name: "Portfolio", url: "https://example.com" },
    });
    expect(created.statusCode).toBe(201);
    const list = await app.inject({ url: "/services" });
    expect(list.json()).toHaveLength(1);
  });

  it("rejects an invalid body", async () => {
    const res = await app.inject({ method: "POST", url: "/services", headers: auth, payload: { name: "x", url: "not-a-url" } });
    expect(res.statusCode).toBe(400);
  });

  it("returns 409 for a duplicate name", async () => {
    const payload = { name: "A", url: "https://a.com" };
    await app.inject({ method: "POST", url: "/services", headers: auth, payload });
    const res = await app.inject({ method: "POST", url: "/services", headers: auth, payload });
    expect(res.statusCode).toBe(409);
  });

  it("returns 404 for checks of an unknown service", async () => {
    const res = await app.inject({ url: "/services/nope/checks" });
    expect(res.statusCode).toBe(404);
  });

  it("rejects writes without an API key (401) and with a wrong one (401)", async () => {
    const payload = { name: "A", url: "https://a.com" };
    const none = await app.inject({ method: "POST", url: "/services", payload });
    const wrong = await app.inject({ method: "POST", url: "/services", payload, headers: { "x-api-key": "nope" } });
    expect(none.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
  });

  it("keeps reads public", async () => {
    expect((await app.inject({ url: "/services" })).statusCode).toBe(200);
  });

  it("returns 503 for writes when no API_KEY is configured", async () => {
    const open = await buildApp(fakeDb(), { urlGuard: allowAnyUrl });
    const res = await open.inject({ method: "POST", url: "/services", headers: auth, payload: { name: "A", url: "https://a.com" } });
    expect(res.statusCode).toBe(503);
  });

  it("rejects private addresses with the real guard (400)", async () => {
    const guarded = await buildApp(fakeDb(), { apiKey: KEY });
    for (const url of ["http://localhost:3000", "http://127.0.0.1", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5"]) {
      const res = await guarded.inject({ method: "POST", url: "/services", headers: auth, payload: { name: url, url } });
      expect(res.statusCode, url).toBe(400);
    }
  });
});
