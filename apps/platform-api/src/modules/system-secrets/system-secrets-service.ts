import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { platformSystemSecrets } from "@ecs/db";

import {
  decryptSecret,
  encryptSecret,
  secretFingerprint,
} from "../../lib/secret-box.js";

export const MEDUSA_ADMIN_TOKEN_SECRET_KEY = "medusa_admin_api_token";

export type SystemSecretsDb = NodePgDatabase<Record<string, unknown>>;

function resolveSystemSecretsEncryptionKey(): string | undefined {
  return (
    process.env.PLATFORM_SECRETS_ENCRYPTION_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    undefined
  );
}

export function createSystemSecretsService(db: SystemSecretsDb) {
  return {
    async getSecret(key: string): Promise<string | null> {
      const encryptionKey = resolveSystemSecretsEncryptionKey();
      if (!encryptionKey) {
        return null;
      }

      const [row] = await db
        .select({
          valueEncrypted: platformSystemSecrets.valueEncrypted,
        })
        .from(platformSystemSecrets)
        .where(eq(platformSystemSecrets.key, key))
        .limit(1);

      if (!row?.valueEncrypted) {
        return null;
      }

      try {
        return decryptSecret(row.valueEncrypted, encryptionKey);
      } catch {
        return null;
      }
    },

    async setSecret(key: string, plaintext: string): Promise<{ fingerprint: string }> {
      const encryptionKey = resolveSystemSecretsEncryptionKey();
      if (!encryptionKey) {
        throw new Error(
          "PLATFORM_SECRETS_ENCRYPTION_KEY or BETTER_AUTH_SECRET is required to store system secrets.",
        );
      }

      const valueEncrypted = encryptSecret(plaintext, encryptionKey);
      const fingerprint = secretFingerprint(plaintext);
      const now = new Date();

      await db
        .insert(platformSystemSecrets)
        .values({
          key,
          valueEncrypted,
          fingerprint,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: platformSystemSecrets.key,
          set: {
            valueEncrypted,
            fingerprint,
            updatedAt: now,
          },
        });

      return { fingerprint };
    },

    /**
     * Postgres advisory lock so concurrent api/worker processes mint at most one key race.
     */
    async withBootstrapLock<T>(fn: () => Promise<T>): Promise<T> {
      // Fixed lock id for medusa admin bootstrap (arbitrary stable int64).
      const lockKey = 882_014_401;
      await db.execute(sql`SELECT pg_advisory_lock(${lockKey})`);
      try {
        return await fn();
      } finally {
        await db.execute(sql`SELECT pg_advisory_unlock(${lockKey})`);
      }
    },
  };
}

export type SystemSecretsService = ReturnType<typeof createSystemSecretsService>;
