import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createPlatformDb } from "./client.js";

const connectionString =
  process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db";

const { db, pool } = createPlatformDb({ connectionString });

await migrate(db, { migrationsFolder: "migrations" });
await pool.end();
