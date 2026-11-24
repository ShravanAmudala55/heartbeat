import { describe, it, expect } from "vitest";
import { pingUrl, recordCheck, FAILURES_BEFORE_INCIDENT } from "../src/checker.js";
import type { Db } from "../src/db.js";
import { allowAnyUrl } from "../src/netguard.js";

/** Tiny in-memory stand-in for the Prisma calls recordCheck uses. */
function fakeDb() {
  const checks: any[] = [];
  const incidents: any[] = [];
  let t = 0;
  const db = {
    check: {
      create: async ({ data }: any) => void checks.push({ ...data, checkedAt: ++t }),
      findMany: async ({ where, take }: any) =>
        checks.filter((c) => c.serviceId === where.serviceId).sort((a, b) => b.checkedAt - a.checkedAt).slice(0, take),
    },
    incident: {
      findFirst: async ({ where }: any) =>
        incidents.find((i) => i.serviceId === where.serviceId && !i.resolvedAt) ?? null,
      create: async ({ data }: any) => void incidents.push({ ...data, resolvedAt: null }),
      updateMany: async ({ where, data }: any) => {
        for (const i of incidents)
          if (i.serviceId === where.serviceId && i.auto === where.auto && !i.resolvedAt) Object.assign(i, data);
      },
    },
  };
  return { db: db as unknown as Db, checks, incidents };
}

const down = { ok: false, statusCode: 500, responseTimeMs: 5, error: "boom" };
const up = { ok: true, statusCode: 200, responseTimeMs: 5, error: null };

describe("pingUrl", () => {
  it("marks 2xx as up", async () => {
    const r = await pingUrl("http://x", 1000, (async () => new Response("ok", { status: 200 })) as any, allowAnyUrl);
    expect(r.ok).toBe(true);
    expect(r.statusCode).toBe(200);
  });
  it("marks 5xx as down", async () => {
    const r = await pingUrl("http://x", 1000, (async () => new Response("", { status: 503 })) as any, allowAnyUrl);
    expect(r.ok).toBe(false);
  });
  it("marks network errors as down with the message", async () => {
    const r = await pingUrl("http://x", 1000, (async () => { throw new Error("ECONNREFUSED"); }) as any, allowAnyUrl);
    expect(r).toMatchObject({ ok: false, statusCode: null, error: "ECONNREFUSED" });
  });
});

describe("recordCheck incident logic", () => {
  it("opens one incident after N consecutive failures", async () => {
    const { db, incidents } = fakeDb();
    for (let i = 0; i < FAILURES_BEFORE_INCIDENT - 1; i++) await recordCheck(db, "s1", down);
    expect(incidents).toHaveLength(0);
    await recordCheck(db, "s1", down);
    await recordCheck(db, "s1", down);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].auto).toBe(true);
  });

  it("does not open an incident when a success interrupts failures", async () => {
    const { db, incidents } = fakeDb();
    await recordCheck(db, "s1", down);
    await recordCheck(db, "s1", down);
    await recordCheck(db, "s1", up);
    await recordCheck(db, "s1", down);
    expect(incidents).toHaveLength(0);
  });

  it("auto-resolves the incident on recovery", async () => {
    const { db, incidents } = fakeDb();
    for (let i = 0; i < 3; i++) await recordCheck(db, "s1", down);
    await recordCheck(db, "s1", up);
    expect(incidents[0].resolvedAt).toBeInstanceOf(Date);
  });
});

describe("pingUrl safety", () => {
  it("does not request a private address and reports it as down", async () => {
    let called = false;
    const r = await pingUrl("http://127.0.0.1:8080", 1000, (async () => { called = true; return new Response("x"); }) as any);
    expect(called).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/private/i);
  });

  it("does not follow redirects", async () => {
    let init: any;
    await pingUrl("http://x", 1000, (async (_u: any, i: any) => { init = i; return new Response(null, { status: 302 }); }) as any, allowAnyUrl);
    expect(init.redirect).toBe("manual");
  });
});
