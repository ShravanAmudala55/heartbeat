import { buildApp } from "./app.js";
import { createDb } from "./db.js";
import { startScheduler } from "./checker.js";

const db = createDb();
const app = await buildApp(db, { logger: true });
const stopScheduler = startScheduler(db, 10_000, (m) => app.log.error(m));

const shutdown = async () => {
  stopScheduler();
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
