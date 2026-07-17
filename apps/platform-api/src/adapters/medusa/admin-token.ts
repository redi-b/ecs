import {
  createSystemSecretsService,
  MEDUSA_ADMIN_TOKEN_SECRET_KEY,
  type SystemSecretsDb,
} from "../../modules/system-secrets/system-secrets-service.js";

export type ResolveMedusaAdminTokenOptions = {
  db: SystemSecretsDb;
  medusaInternalUrl: string;
  internalApiToken: string | undefined;
  /** Env override (break-glass / local). Wins when non-empty. */
  envToken?: string | undefined;
  fetchImpl?: typeof fetch;
  /** Persist env token into DB when DB row is empty (optional convenience). */
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

async function probeAdminToken(
  medusaInternalUrl: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  const base = medusaInternalUrl.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}/admin/regions?limit=1`, {
      headers: {
        authorization: `Basic ${token}`,
        accept: "application/json",
      },
    });
    // 401/403 = bad token; other errors may be transient — treat 2xx/404 as usable enough
    if (response.status === 401 || response.status === 403) {
      return false;
    }
    return true;
  } catch {
    // Medusa not reachable yet — do not discard a stored token
    return true;
  }
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

/**
 * Resolve Medusa secret admin API token: env → encrypted DB → internal bootstrap.
 */
export async function resolveMedusaAdminToken(
  options: ResolveMedusaAdminTokenOptions,
): Promise<ResolveMedusaAdminTokenResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const secrets = createSystemSecretsService(options.db);
  const envToken = options.envToken?.trim() || process.env.MEDUSA_ADMIN_API_TOKEN?.trim() || "";

  if (envToken) {
    if (options.persistEnvTokenToDb !== false) {
      try {
        const existing = await secrets.getSecret(MEDUSA_ADMIN_TOKEN_SECRET_KEY);
        if (!existing) {
          await secrets.setSecret(MEDUSA_ADMIN_TOKEN_SECRET_KEY, envToken);
        }
      } catch (error) {
        options.logger?.warn?.(
          { err: error instanceof Error ? error.message : "persist_failed" },
          "medusa_admin_token_env_persist_skipped",
        );
      }
    }
    return { ok: true, token: envToken, source: "env" };
  }

  return secrets.withBootstrapLock(async () => {
    // Re-check DB under lock (another replica may have bootstrapped).
    const fromDb = await secrets.getSecret(MEDUSA_ADMIN_TOKEN_SECRET_KEY);
    if (fromDb) {
      const valid = await probeAdminToken(options.medusaInternalUrl, fromDb, fetchImpl);
      if (valid) {
        return { ok: true, token: fromDb, source: "db" };
      }
      options.logger?.warn?.({}, "medusa_admin_token_db_invalid_rebootstrap");
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
      forceNewKey: Boolean(fromDb),
    });

    if (!bootstrapped.ok) {
      return bootstrapped;
    }

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

    options.logger?.info?.(
      { source: "bootstrap", fingerprint: bootstrapped.token.slice(-4) },
      "medusa_admin_token_bootstrapped",
    );

    return { ok: true, token: bootstrapped.token, source: "bootstrap" };
  });
}
