import type { createPlatformDb } from "@ecs/db";
import { auditLogs, operatorNotes, users } from "@ecs/db";
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
  operatorEmail?: string | null;
  operatorName?: string | null;
  visibility: string;
}): SupportNote {
  const { operatorEmail, operatorName, ...value } = note;
  return {
    ...value,
    operator:
      operatorName && operatorEmail
        ? { id: note.operatorUserId, name: operatorName, email: operatorEmail }
        : null,
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
            operatorName: users.name,
            operatorEmail: users.email,
            body: operatorNotes.body,
            visibility: operatorNotes.visibility,
            createdAt: operatorNotes.createdAt,
          })
          .from(operatorNotes)
          .leftJoin(users, eq(operatorNotes.operatorUserId, users.id))
          .where(eq(operatorNotes.tenantId, input.tenantId))
          .orderBy(desc(operatorNotes.createdAt))
          .limit(input.limit),
        db
          .select({
            id: auditLogs.id,
            actorUserId: auditLogs.actorUserId,
            actorName: users.name,
            actorEmail: users.email,
            action: auditLogs.action,
            targetType: auditLogs.targetType,
            targetId: auditLogs.targetId,
            metadata: auditLogs.metadata,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .leftJoin(users, eq(auditLogs.actorUserId, users.id))
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
            actor:
              log.actorUserId && log.actorName && log.actorEmail
                ? { id: log.actorUserId, name: log.actorName, email: log.actorEmail }
                : null,
            createdAt: log.createdAt.toISOString(),
          })),
        },
      };
    },
    createOperatorSupportNote: async (input: {
      body: string;
      operatorUserId: string;
      platformPrincipalId: string;
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
          platformPrincipalId: input.platformPrincipalId,
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
        note: serializeSupportNote({ ...note, operatorEmail: null, operatorName: null }),
      };
    },
  };
}
