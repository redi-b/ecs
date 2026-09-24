import {
  auditLogs,
  createPlatformDb,
  platformPermissionGrants,
  platformPrincipals,
  users,
} from "@ecs/db";
import { and, eq } from "drizzle-orm";
import { loadPlatformApiEnvFiles } from "../config/env.js";
import { parsePlatformAccessBootstrapInput } from "./platform-access-bootstrap-input.js";

loadPlatformApiEnvFiles();

const input = parsePlatformAccessBootstrapInput(process.argv.slice(2));
const connectionString = process.env.PLATFORM_DATABASE_URL?.trim();
if (!connectionString) throw new Error("PLATFORM_DATABASE_URL is required");
const { db, pool } = createPlatformDb({ connectionString, max: 1 });

try {
  const principal = await db.transaction(async (transaction) => {
    const [target] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.status, "active")))
      .limit(1);
    const [confirmer] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.confirmedByUserId), eq(users.status, "active")))
      .limit(1);
    if (!target || !confirmer)
      throw new Error("Target and confirming users must both exist and be active");
    const [created] = await transaction
      .insert(platformPrincipals)
      .values({ userId: input.userId })
      .onConflictDoUpdate({
        target: platformPrincipals.userId,
        set: { status: "active", updatedAt: new Date() },
      })
      .returning({ id: platformPrincipals.id, userId: platformPrincipals.userId });
    if (!created) throw new Error("Platform principal upsert returned no row");
    for (const permission of input.permissions) {
      await transaction
        .insert(platformPermissionGrants)
        .values({
          principalId: created.id,
          permission,
          grantedByUserId: input.confirmedByUserId,
          expiresAt: input.expiresAt,
        })
        .onConflictDoUpdate({
          target: [platformPermissionGrants.principalId, platformPermissionGrants.permission],
          set: {
            grantedByUserId: input.confirmedByUserId,
            expiresAt: input.expiresAt,
            revokedAt: null,
          },
        });
    }
    await transaction.insert(auditLogs).values({
      actorUserId: input.confirmedByUserId,
      platformPrincipalId: created.id,
      action: "platform.permissions_bootstrapped",
      targetType: "platform_principal",
      targetId: created.id,
      metadata: {
        permissions: input.permissions,
        expiresAt: input.expiresAt?.toISOString() ?? null,
      },
    });
    return created;
  });
  process.stdout.write(
    `Platform principal ${principal.id} granted ${input.permissions.length} permission(s).\n`,
  );
} finally {
  await pool.end();
}
