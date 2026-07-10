import type { createPlatformDb } from "@ecs/db";
import { auditLogs, operatorNotes } from "@ecs/db";
import { desc, eq } from "drizzle-orm";

import type {
  SupportHistoryResult,
  SupportNote,
  SupportNoteCreateResult,
} from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

function serializeSupportNote(note: {
  body: string;
  createdAt: Date;
  id: string;
  operatorUserId: string;
  visibility: string;
}): SupportNote {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
  };
}

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
          notes: notes.map((note) => serializeSupportNote(note)),
          auditLogs: logs.map((log) => ({
            ...log,
            createdAt: log.createdAt.toISOString(),
          })),
        },
      };
    },
    createOperatorSupportNote: async (input: {
      body: string;
      operatorUserId: string;
      tenantId: string;
      visibility?: string | null | undefined;
    }): Promise<SupportNoteCreateResult> => {
      const note = await db.transaction(async (transaction) => {
        const [createdNote] = await transaction
          .insert(operatorNotes)
          .values({
            body: input.body,
            operatorUserId: input.operatorUserId,
            tenantId: input.tenantId,
            visibility: input.visibility ?? "internal",
          })
          .returning({
            id: operatorNotes.id,
            operatorUserId: operatorNotes.operatorUserId,
            body: operatorNotes.body,
            visibility: operatorNotes.visibility,
            createdAt: operatorNotes.createdAt,
          });

        if (!createdNote) {
          throw new Error("Support note insert returned no rows.");
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          tenantId: input.tenantId,
          action: "support.note_created",
          targetType: "operator_note",
          targetId: createdNote.id,
          metadata: {
            visibility: createdNote.visibility,
          },
        });

        return createdNote;
      });

      return {
        ok: true,
        note: serializeSupportNote(note),
      };
    },
  };
}
