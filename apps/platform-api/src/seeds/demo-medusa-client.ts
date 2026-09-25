import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPlatformApiServiceDir } from "../config/env.js";

type DemoMedusaClientOptions = {
  env: NodeJS.ProcessEnv;
  getAdminToken: () => string;
  medusaInternalUrl: string;
};

export function createDemoMedusaClient(options: DemoMedusaClientOptions) {
  function resolveDatabaseUrl() {
    const direct = options.env.MEDUSA_DATABASE_URL?.trim();
    if (direct) return direct;

    const candidates = [
      resolve(getPlatformApiServiceDir(import.meta.url), "../medusa/.env"),
      resolve(getPlatformApiServiceDir(import.meta.url), "../../.env"),
    ];
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      const match = readFileSync(path, "utf8")
        .split(/\r?\n/)
        .find((line) => line.trim().startsWith("DATABASE_URL="));
      if (!match) continue;
      const value = match
        .slice(match.indexOf("=") + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
      if (value) return value;
    }

    return deriveMedusaUrlFromPlatformDatabaseUrl(options.env.PLATFORM_DATABASE_URL);
  }

  function deriveMedusaUrlFromPlatformDatabaseUrl(platformUrl: string | undefined) {
    if (!platformUrl?.trim()) return undefined;
    const raw = platformUrl.trim();
    try {
      const parsed = new URL(raw);
      const dbName = parsed.pathname.replace(/^\//, "");
      if (dbName === "platform_db" || dbName === "platform") {
        parsed.pathname = "/medusa_db";
        return parsed.toString();
      }
    } catch {
      // Fall through to conservative string replacement.
    }
    if (/\/platform_db(?:\?|$)/.test(raw)) {
      return raw.replace(/\/platform_db(?=\?|$)/, "/medusa_db");
    }
    if (/\/platform(?:\?|$)/.test(raw)) {
      return raw.replace(/\/platform(?=\?|$)/, "/medusa_db");
    }
    return undefined;
  }

  async function loadPgModule() {
    try {
      // @ts-ignore - dynamic optional pg dependency in monorepo
      return await import("pg");
    } catch {
      // Fallbacks support monorepo development layouts.
    }

    const { createRequire } = await import("node:module");
    const { pathToFileURL } = await import("node:url");
    const candidates = [
      resolve(getPlatformApiServiceDir(import.meta.url), "node_modules/pg/lib/index.js"),
      resolve(getPlatformApiServiceDir(import.meta.url), "../../node_modules/pg/lib/index.js"),
    ];
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      try {
        return await import(pathToFileURL(candidate).href);
      } catch {
        // Try the next candidate.
      }
    }
    try {
      const requireFromDb = createRequire(
        resolve(getPlatformApiServiceDir(import.meta.url), "../../packages/db/package.json"),
      );
      // @ts-ignore - dynamic optional pg dependency in monorepo
      return requireFromDb("pg") as { Client: new (options?: unknown) => { connect(): Promise<void>; query(q: string, p?: unknown[]): Promise<{ rows: unknown[] }>; end(): Promise<void> } };
    } catch {
      return null;
    }
  }

  async function getPgClient() {
    const connectionString = resolveDatabaseUrl();
    if (!connectionString) return null;
    const pg = await loadPgModule();
    if (!pg) return null;
    const Client = "Client" in pg ? pg.Client : pg.default?.Client;
    if (!Client) return null;
    const client = new Client({ connectionString });
    await client.connect();
    return client;
  }

  async function request<T = unknown>(path: string, init: RequestInit): Promise<T | null> {
    const adminToken = options.getAdminToken();
    if (!adminToken) return null;
    const response = await fetch(`${options.medusaInternalUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Basic ${adminToken}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    }).catch(() => null);

    if (!response?.ok) {
      if (options.env.SEED_DEMO_DEBUG === "true") {
        const body = await response?.text().catch(() => "");
        console.warn(
          `[seed:demo] ${init.method ?? "GET"} ${path} → ${response?.status ?? "network"} ${body?.slice(0, 200) ?? ""}`,
        );
      }
      return null;
    }
    if (response.status === 204) return {} as T;
    return (await response.json().catch(() => null)) as T | null;
  }

  return {
    async backdateOrders(entries: Array<{ id: string; createdAt: Date }>) {
      if (!entries.length) return;
      const client = await getPgClient();
      if (!client) return;
      try {
        for (const entry of entries) {
          await client.query(`UPDATE "order" SET created_at = $1, updated_at = $1 WHERE id = $2`, [
            entry.createdAt,
            entry.id,
          ]);
        }
      } finally {
        await client.end();
      }
    },
    async delete(path: string) {
      await request(path, { method: "DELETE" });
    },
    get<T>(path: string) {
      return request<T>(path, { method: "GET" });
    },
    post<T>(path: string, body: unknown) {
      return request<T>(path, {
        body: JSON.stringify(body),
        method: "POST",
      });
    },
  };
}
