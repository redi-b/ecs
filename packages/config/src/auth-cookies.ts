/**
 * Better Auth cookie naming.
 * Docs: advanced.cookiePrefix → cookies named `${prefix}.session_token`
 * (plus `__Secure-` when secure cookies are enabled).
 *
 * @see https://www.better-auth.com/docs/concepts/cookies
 */

/** Default brand prefix when BETTER_AUTH_COOKIE_PREFIX is unset. */
export const DEFAULT_AUTH_COOKIE_PREFIX = "ecs";

/** Legacy Better Auth default — cleared on sign-out after renames. */
export const LEGACY_AUTH_COOKIE_PREFIX = "better-auth";

/**
 * Resolve cookie prefix from env (BETTER_AUTH_COOKIE_PREFIX), falling back to `ecs`.
 * Strips accidental `__Secure-` / invalid characters so cookie names stay valid.
 */
export function getAuthCookiePrefix(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const raw = env.BETTER_AUTH_COOKIE_PREFIX?.trim() || env.AUTH_COOKIE_PREFIX?.trim();
  if (!raw) return DEFAULT_AUTH_COOKIE_PREFIX;

  const cleaned = raw
    .replace(/^__Secure-/i, "")
    .replace(/^__Host-/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .replace(/^\.+|\.+$/g, "");

  return cleaned || DEFAULT_AUTH_COOKIE_PREFIX;
}

/** Base name without secure prefix: `{prefix}.session_token`. */
export function getAuthSessionCookieBaseName(prefix?: string): string {
  return `${prefix ?? getAuthCookiePrefix()}.session_token`;
}

/**
 * Cookie names the browser may hold for the session token
 * (plain + __Secure- variant used when useSecureCookies is true).
 */
export function getAuthSessionCookieNames(prefix?: string): string[] {
  const base = getAuthSessionCookieBaseName(prefix);
  return [base, `__Secure-${base}`];
}

/**
 * Names to clear on sign-out: current prefix + legacy `better-auth` so renames
 * do not leave orphan session cookies behind.
 */
export function getAuthSessionCookieNamesToClear(prefix?: string): string[] {
  const current = getAuthSessionCookieNames(prefix);
  const active = prefix ?? getAuthCookiePrefix();
  if (active === LEGACY_AUTH_COOKIE_PREFIX) {
    return current;
  }
  return [...new Set([...current, ...getAuthSessionCookieNames(LEGACY_AUTH_COOKIE_PREFIX)])];
}
