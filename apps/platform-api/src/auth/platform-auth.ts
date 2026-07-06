import type { createPlatformDb } from "@ecs/db";
import * as schema from "@ecs/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createPlatformAuth(options: {
  baseUrl?: string | undefined;
  db: PlatformDb;
  secret: string;
  trustedOrigins?: string[] | undefined;
}) {
  return betterAuth({
    advanced: {
      trustedProxyHeaders: true,
    },
    basePath: "/platform/auth",
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
    database: drizzleAdapter(options.db, {
      provider: "pg",
      schema: {
        ...schema,
        account: schema.accounts,
        session: schema.sessions,
        user: schema.users,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    secret: options.secret,
    ...(options.trustedOrigins?.length ? { trustedOrigins: options.trustedOrigins } : {}),
    user: {
      modelName: "users",
    },
    session: {
      modelName: "sessions",
    },
    account: {
      modelName: "accounts",
    },
    verification: {
      modelName: "verifications",
    },
  });
}

export type PlatformAuth = ReturnType<typeof createPlatformAuth>;

export function parseTrustedOrigins(value: string | undefined) {
  return value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
