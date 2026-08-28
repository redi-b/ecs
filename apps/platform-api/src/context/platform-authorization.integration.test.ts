import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlatformDb,
  platformPermissionGrants,
  platformPrincipals,
  sessions,
  users,
} from "@ecs/db";
import { eq } from "drizzle-orm";
import { appWithResolution } from "../test/platform-app-harness.js";
import { createPlatformAuth } from "./platform-auth.js";
import { createPlatformPermissionAuthorization } from "./platform-authorization.js";

const connectionString = process.env.PLATFORM_AUTH_INTEGRATION_DATABASE_URL;

test(
  "platform grants deny expired, revoked, and inactive authority in PostgreSQL",
  {
    skip: connectionString ? false : "PLATFORM_AUTH_INTEGRATION_DATABASE_URL is not set",
  },
  async () => {
    const { db, pool } = createPlatformDb({ connectionString: connectionString as string, max: 1 });
    const userId = "phase4a-integration-user";
    try {
      await db
        .insert(users)
        .values({ id: userId, name: "Phase 4A", email: "phase4a@example.test" });
      const [principal] = await db
        .insert(platformPrincipals)
        .values({ userId })
        .returning({ id: platformPrincipals.id });
      assert.ok(principal);
      const [grant] = await db
        .insert(platformPermissionGrants)
        .values({
          principalId: principal.id,
          permission: "tenants.read",
          expiresAt: new Date(Date.now() + 60_000),
        })
        .returning({ id: platformPermissionGrants.id });
      assert.ok(grant);
      const authorize = createPlatformPermissionAuthorization(db);
      assert.equal((await authorize({ permission: "tenants.read", userId })).ok, true);
      assert.equal((await authorize({ permission: "tenants.status.update", userId })).ok, false);

      await db
        .update(platformPermissionGrants)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(platformPermissionGrants.id, grant.id));
      assert.equal((await authorize({ permission: "tenants.read", userId })).ok, false);

      await db
        .update(platformPermissionGrants)
        .set({ expiresAt: null, revokedAt: new Date() })
        .where(eq(platformPermissionGrants.id, grant.id));
      assert.equal((await authorize({ permission: "tenants.read", userId })).ok, false);

      await db
        .update(platformPermissionGrants)
        .set({ revokedAt: null })
        .where(eq(platformPermissionGrants.id, grant.id));
      await db
        .update(platformPrincipals)
        .set({ status: "disabled" })
        .where(eq(platformPrincipals.id, principal.id));
      assert.equal((await authorize({ permission: "tenants.read", userId })).ok, false);
    } finally {
      await pool.end();
    }
  },
);

test(
  "expired and revoked Better Auth sessions fail at the operator route boundary",
  {
    skip: connectionString ? false : "PLATFORM_AUTH_INTEGRATION_DATABASE_URL is not set",
  },
  async () => {
    const { db, pool } = createPlatformDb({ connectionString: connectionString as string, max: 1 });
    const auth = createPlatformAuth({
      baseUrl: "http://platform.test",
      db,
      secret: "phase4a-integration-secret-at-least-32-characters",
    });
    const email = "phase4a-session@example.test";
    const password = "Phase4a-session-password";
    try {
      const signup = await auth.api.signUpEmail({
        body: { email, name: "Phase 4A Session", password },
        returnHeaders: true,
      });
      const userId = signup.response.user.id;
      const [principal] = await db
        .insert(platformPrincipals)
        .values({ userId })
        .returning({ id: platformPrincipals.id });
      assert.ok(principal);
      await db
        .insert(platformPermissionGrants)
        .values({ principalId: principal.id, permission: "tenants.read" });
      const authorize = createPlatformPermissionAuthorization(db);
      const app = appWithResolution(
        { ok: false, error: "shop_context_required" },
        {
          getSession: async (headers) => auth.api.getSession({ headers }),
          authorizePlatformPermission: authorize,
          listSuperadminTenants: async ({ limit, offset }) => ({
            tenants: [],
            count: 0,
            limit,
            offset,
          }),
        },
      );
      const signupCookie = toCookieHeader(signup.headers);
      assert.equal(
        (await app.request("/platform/operator/tenants", { headers: { cookie: signupCookie } }))
          .status,
        200,
      );

      await db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(sessions.userId, userId));
      assert.equal(
        (await app.request("/platform/operator/tenants", { headers: { cookie: signupCookie } }))
          .status,
        401,
      );

      const signin = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
      const signinCookie = toCookieHeader(signin.headers);
      assert.equal(
        (await app.request("/platform/operator/tenants", { headers: { cookie: signinCookie } }))
          .status,
        200,
      );
      await db.delete(sessions).where(eq(sessions.userId, userId));
      assert.equal(
        (await app.request("/platform/operator/tenants", { headers: { cookie: signinCookie } }))
          .status,
        401,
      );
    } finally {
      await pool.end();
    }
  },
);

function toCookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}
