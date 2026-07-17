import {
  createSystemSecretsService,
  MEDUSA_ADMIN_TOKEN_SECRET_KEY,
  type SystemSecretsDb,
} from "../../modules/system-secrets/system-secrets-service.js";

export type ResolveMedusaAdminTokenOptions = {
  db: SystemSecretsDb;
  medusaInternalUrl: string;
  internalApiToken: string | undefined;
  /** Env override (break-glass / local). Preferred when non-empty and valid. */
  envToken?: string | undefined;
  fetchImpl?: typeof fetch;
  /** Persist a working token into encrypted DB (default true). */
  persistEnvTokenToDb?: boolean;
  logger?: {
    info?: (fields: Record<string, unknown>, msg: string) => void;
    warn?: (fields: Record<string, unknown>, msg: string) => void;
    error?: (fields: Record<string, unknown>, msg: string) => void;
  };
};

export type ResolveMedusaAdminTokenResult =
  | { ok: true; token: string; source: "env" | "db" | "bootstrap" }
  | { ok: false; error: string };

export type ProbeAdminTokenResult =
  | { ok: true; reachable: true }
  | { ok: false; reachable: true; status: number }
  | { ok: false; reachable: false };

/**
 * Probe a Medusa secret admin token.
 * - reachable:false → Medusa down (do not discard a stored token yet)
 * - ok:false + reachable → token rejected (401/403) or unexpected
 */
export async function probeAdminTokenDetailed(
  medusaInternalUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeAdminTokenResult> {
  const base = medusaInternalUrl.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}/admin/regions?limit=1`, {
      headers: {
        authorization: `Basic ${token}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reachable: true, status: response.status };
    }
    // 2xx/404/etc. while Medusa is up — treat as usable enough for admin auth.
    return { ok: true, reachable: true };
  } catch {
    return { ok: false, reachable: false };
  }
}

async function probeAdminToken(
  medusaInternalUrl: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<"valid" | "invalid" | "unreachable"> {
  const result = await probeAdminTokenDetailed(medusaInternalUrl, token, fetchImpl);
  if (result.ok) return "valid";
  if (!result.reachable) return "unreachable";
  return "invalid";
}

async function requestBootstrapToken(options: {
  medusaInternalUrl: string;
  internalApiToken: string;
  fetchImpl: typeof fetch;
  forceNewKey?: boolean;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const base = options.medusaInternalUrl.replace(/\/$/, "");
  try {
    const response = await options.fetchImpl(`${base}/internal/platform/bootstrap-admin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-internal-token": options.internalApiToken,
      },
      body: JSON.stringify({
        forceNewKey: options.forceNewKey === true,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const data = (await response.json().catch(() => undefined)) as
      | { medusaAdminApiToken?: string; error?: string }
      | undefined;

    if (!response.ok) {
      return {
        ok: false,
        error:
          (typeof data?.error === "string" && data.error) ||
          `commerce_bootstrap_http_${response.status}`,
      };
    }

    const token = typeof data?.medusaAdminApiToken === "string" ? data.medusaAdminApiToken.trim() : "";
    if (!token) {
      return { ok: false, error: "commerce_bootstrap_missing_token" };
    }

    return { ok: true, token };
  } catch {
    return { ok: false, error: "commerce_bootstrap_unreachable" };
  }
}

async function persistToken(
  secrets: ReturnType<typeof createSystemSecretsService>,
  token: string,
  logger: ResolveMedusaAdminTokenOptions["logger"],
) {
  try {
    await secrets.setSecret(MEDUSA_ADMIN_TOKEN_SECRET_KEY, token);
  } catch (error) {
    logger?.warn?.(
      { err: error instanceof Error ? error.message : "persist_failed" },
      "medusa_admin_token_persist_skipped",
    );
  }
}

/**
 * Resolve Medusa secret admin API token: env → encrypted DB → internal bootstrap.
 *
 * Always probes when Medusa is reachable so a wiped Medusa / rotated key cannot
 * leave platform-api stuck returning 401 on every catalog call.
 */
export async function resolveMedusaAdminToken(
  options: ResolveMedusaAdminTokenOptions,
): Promise<ResolveMedusaAdminTokenResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const secrets = createSystemSecretsService(options.db);
  const envToken = options.envToken?.trim() || process.env.MEDUSA_ADMIN_API_TOKEN?.trim() || "";
  const shouldPersist = options.persistEnvTokenToDb !== false;

  if (envToken) {
    const envProbe = await probeAdminToken(options.medusaInternalUrl, envToken, fetchImpl);
    if (envProbe === "valid" || envProbe === "unreachable") {
      if (shouldPersist && envProbe === "valid") {
        // Overwrite stale DB secrets after Medusa re-seed (was: only insert when empty).
        const existing = await secrets.getSecret(MEDUSA_ADMIN_TOKEN_SECRET_KEY);
        if (existing !== envToken) {
          await persistToken(secrets, envToken, options.logger);
        }
      }
      if (envProbe === "unreachable") {
        options.logger?.warn?.(
          { fingerprint: envToken.slice(-4) },
          "medusa_admin_token_env_unverified_medusa_unreachable",
        );
      }
      return { ok: true, token: envToken, source: "env" };
    }

    options.logger?.warn?.(
      { fingerprint: envToken.slice(-4) },
      "medusa_admin_token_env_invalid_falling_through",
    );
  }

  return secrets.withBootstrapLock(async () => {
    // Re-check DB under lock (another replica may have bootstrapped).
    const fromDb = await secrets.getSecret(MEDUSA_ADMIN_TOKEN_SECRET_KEY);
    if (fromDb) {
      const dbProbe = await probeAdminToken(options.medusaInternalUrl, fromDb, fetchImpl);
      if (dbProbe === "valid" || dbProbe === "unreachable") {
        if (dbProbe === "unreachable") {
          options.logger?.warn?.(
            { fingerprint: fromDb.slice(-4) },
            "medusa_admin_token_db_unverified_medusa_unreachable",
          );
        }
        return { ok: true, token: fromDb, source: "db" };
      }
      options.logger?.warn?.(
        { fingerprint: fromDb.slice(-4) },
        "medusa_admin_token_db_invalid_rebootstrap",
      );
    }

    if (!options.internalApiToken?.trim()) {
      return {
        ok: false,
        error: "platform_internal_token_missing",
      };
    }

    const bootstrapped = await requestBootstrapToken({
      medusaInternalUrl: options.medusaInternalUrl,
      internalApiToken: options.internalApiToken,
      fetchImpl,
      // Always mint a fresh key when previous material was invalid or missing.
      forceNewKey: true,
    });

    if (!bootstrapped.ok) {
      return bootstrapped;
    }

    if (shouldPersist) {
      try {
        await secrets.setSecret(MEDUSA_ADMIN_TOKEN_SECRET_KEY, bootstrapped.token);
      } catch (error) {
        options.logger?.error?.(
          { err: error instanceof Error ? error.message : "encrypt_failed" },
          "medusa_admin_token_persist_failed",
        );
        // Still return token for this process lifetime
        return { ok: true, token: bootstrapped.token, source: "bootstrap" };
      }
    }

    options.logger?.info?.(
      { source: "bootstrap", fingerprint: bootstrapped.token.slice(-4) },
      "medusa_admin_token_bootstrapped",
    );

    return { ok: true, token: bootstrapped.token, source: "bootstrap" };
  });
}
