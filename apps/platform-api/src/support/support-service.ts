import type { createPlatformDb } from "@ecs/db";
import { auditLogs, operatorNotes } from "@ecs/db";
import { desc, eq } from "drizzle-orm";

import type { SupportHistoryResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createSupportService(db: PlatformDb) {
  return {
    getOperatorSupportHistory: async (input: {
      limit: number;
      tenantId: string;
    }): Promise<SupportHistoryResult> => {
      const [notes, logs] = await Promise.all([
        db
          .select({
            id: operatorNotes.id,
            operatorUserId: operatorNotes.operatorUserId,
            body: operatorNotes.body,
            visibility: operatorNotes.visibility,
            createdAt: operatorNotes.createdAt,
          })
          .from(operatorNotes)
          .where(eq(operatorNotes.tenantId, input.tenantId))
          .orderBy(desc(operatorNotes.createdAt))
          .limit(input.limit),
        db
          .select({
            id: auditLogs.id,
            actorUserId: auditLogs.actorUserId,
            action: auditLogs.action,
            targetType: auditLogs.targetType,
            targetId: auditLogs.targetId,
            metadata: auditLogs.metadata,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(eq(auditLogs.tenantId, input.tenantId))
          .orderBy(desc(auditLogs.createdAt))
          .limit(input.limit),
      ]);

      return {
        ok: true,
        history: {
          notes: notes.map((note) => ({
            ...note,
            createdAt: note.createdAt.toISOString(),
          })),
          auditLogs: logs.map((log) => ({
            ...log,
            createdAt: log.createdAt.toISOString(),
          })),
        },
      };
    },
  };
}
