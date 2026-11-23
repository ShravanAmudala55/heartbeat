import type { Db } from "./db.js";

export const FAILURES_BEFORE_INCIDENT = 3;

export interface CheckResult {
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
}

type FetchFn = typeof fetch;

/** Ping a URL once. Any 2xx/3xx counts as up; errors and timeouts count as down. */
export async function pingUrl(
  url: string,
  timeoutMs = 10_000,
  fetchFn: FetchFn = fetch,
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetchFn(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      ok: res.status >= 200 && res.status < 400,
      statusCode: res.status,
      responseTimeMs: Date.now() - start,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: null,
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Save a check result and update incidents:
 * - N failures in a row with no open incident -> open an automatic incident
 * - a success while an automatic incident is open -> resolve it
 */
export async function recordCheck(db: Db, serviceId: string, result: CheckResult) {
  await db.check.create({ data: { serviceId, ...result } });

  if (result.ok) {
    await db.incident.updateMany({
      where: { serviceId, auto: true, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    return;
  }

  const recent = await db.check.findMany({
    where: { serviceId },
    orderBy: { checkedAt: "desc" },
    take: FAILURES_BEFORE_INCIDENT,
  });
  const allFailed =
    recent.length === FAILURES_BEFORE_INCIDENT && recent.every((c) => !c.ok);
  if (!allFailed) return;

  const open = await db.incident.findFirst({ where: { serviceId, resolvedAt: null } });
  if (open) return;

  await db.incident.create({
    data: {
      serviceId,
      auto: true,
      title: `Service down: ${FAILURES_BEFORE_INCIDENT} failed checks in a row`,
      notes: result.error,
    },
  });
}

/** Check every active service that is due (never checked, or older than its interval). */
export async function runDueChecks(db: Db, fetchFn: FetchFn = fetch) {
  const services = await db.service.findMany({
    where: { active: true },
    include: { checks: { orderBy: { checkedAt: "desc" }, take: 1 } },
  });
  const now = Date.now();
  const due = services.filter((s) => {
    const last = s.checks[0]?.checkedAt.getTime();
    return last === undefined || now - last >= s.intervalSeconds * 1000;
  });
  await Promise.all(
    due.map(async (s) => recordCheck(db, s.id, await pingUrl(s.url, 10_000, fetchFn))),
  );
  return due.length;
}

/** Poll for due checks every `tickMs`. Returns a stop function. */
export function startScheduler(db: Db, tickMs = 10_000, log: (m: string) => void = console.log) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runDueChecks(db);
    } catch (err) {
      log(`scheduler error: ${err instanceof Error ? err.message : err}`);
    } finally {
      running = false;
    }
  }, tickMs);
  return () => clearInterval(timer);
}
