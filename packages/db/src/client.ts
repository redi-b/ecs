import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema/index.js";

export type PlatformDbOptions = {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
};

export function createPlatformDb(options: PlatformDbOptions) {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 5,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
  });

  return {
    pool,
    db: drizzle(pool, { schema }),
  };
}
