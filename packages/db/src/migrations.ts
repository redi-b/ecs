import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createPlatformDb } from "./client.js";

const connectionString =
  process.env.PLATFORM_DATABASE_URL ??
  `postgres://ecs:ecs@localhost:${process.env.POSTGRES_HOST_PORT ?? "5432"}/platform_db`;

const { db, pool } = createPlatformDb({ connectionString });
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

await migrate(db, { migrationsFolder });
await pool.end();
