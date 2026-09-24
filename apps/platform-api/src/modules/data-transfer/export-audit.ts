import { auditLogs, type createPlatformDb } from "@ecs/db";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createDataExportAuditRecorder(db: PlatformDb) {
  return async (input: {
    actorUserId: string;
    exportType: "orders" | "customers";
    rowCount: number;
    schemaVersion: string;
    tenantId: string;
  }) => {
    await db.insert(auditLogs).values({
      action: `merchant.${input.exportType}.exported`,
      actorUserId: input.actorUserId,
      metadata: {
        rowCount: input.rowCount,
        schemaVersion: input.schemaVersion,
      },
      targetType: `${input.exportType}_export`,
      tenantId: input.tenantId,
    });
  };
}
