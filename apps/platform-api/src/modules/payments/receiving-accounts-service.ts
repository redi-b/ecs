import type { createPlatformDb } from "@ecs/db";
import { merchantReceivingAccounts } from "@ecs/db";
import { and, asc, desc, eq } from "drizzle-orm";

import {
  encryptSecret,
  secretFingerprint,
} from "../../lib/secret-box.js";
import { ETHIOPIAN_BANK_CATALOG } from "../../lib/settlement.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type ReceivingAccountPublic = {
  id: string;
  bankCode: string | null;
  bankName: string;
  accountName: string | null;
  accountLast4: string | null;
  label: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: typeof merchantReceivingAccounts.$inferSelect): ReceivingAccountPublic {
  return {
    id: row.id,
    bankCode: row.bankCode,
    bankName: row.bankName,
    accountName: row.accountName,
    accountLast4: row.accountLast4,
    label: row.label,
    isDefault: row.isDefault,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createReceivingAccountsService(
  db: PlatformDb,
  options: { encryptionKey?: string | undefined } = {},
) {
  const encryptionKey = options.encryptionKey;

  function sealAccountNumber(plaintext: string | null | undefined) {
    const value = plaintext?.trim();
    if (!value) return { encrypted: null as string | null, last4: null as string | null };
    const last4 = secretFingerprint(value);
    if (encryptionKey?.trim()) {
      return { encrypted: encryptSecret(value, encryptionKey), last4 };
    }
    return { encrypted: value, last4 };
  }

  return {
    listBanks() {
      return { ok: true as const, banks: ETHIOPIAN_BANK_CATALOG };
    },

    async listAccounts(input: {
      tenantId: string;
      includeInactive?: boolean | undefined;
    }) {
      const rows = await db
        .select()
        .from(merchantReceivingAccounts)
        .where(
          input.includeInactive
            ? eq(merchantReceivingAccounts.tenantId, input.tenantId)
            : and(
                eq(merchantReceivingAccounts.tenantId, input.tenantId),
                eq(merchantReceivingAccounts.isActive, true),
              ),
        )
        .orderBy(desc(merchantReceivingAccounts.isDefault), asc(merchantReceivingAccounts.label));

      return { ok: true as const, accounts: rows.map(mapRow) };
    },

    async createAccount(input: {
      tenantId: string;
      bankCode?: string | null | undefined;
      bankName: string;
      accountName?: string | null | undefined;
      accountNumber?: string | null | undefined;
      label: string;
      isDefault?: boolean | undefined;
    }) {
      const label = input.label.trim();
      const bankName = input.bankName.trim();
      if (!label || !bankName) {
        return { ok: false as const, error: "invalid_receiving_account", status: 400 as const };
      }

      const sealed = sealAccountNumber(input.accountNumber);
      const makeDefault = input.isDefault === true;

      if (makeDefault) {
        await db
          .update(merchantReceivingAccounts)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(merchantReceivingAccounts.tenantId, input.tenantId));
      }

      try {
        const [row] = await db
          .insert(merchantReceivingAccounts)
          .values({
            tenantId: input.tenantId,
            bankCode: input.bankCode?.trim() || null,
            bankName,
            accountName: input.accountName?.trim() || null,
            accountNumberEncrypted: sealed.encrypted,
            accountLast4: sealed.last4,
            label,
            isDefault: makeDefault,
            isActive: true,
          })
          .returning();

        if (!row) {
          return { ok: false as const, error: "receiving_account_create_failed", status: 503 as const };
        }
        return { ok: true as const, account: mapRow(row) };
      } catch {
        return { ok: false as const, error: "receiving_account_label_taken", status: 409 as const };
      }
    },

    async updateAccount(input: {
      tenantId: string;
      accountId: string;
      bankCode?: string | null | undefined;
      bankName?: string | undefined;
      accountName?: string | null | undefined;
      accountNumber?: string | null | undefined;
      label?: string | undefined;
      isDefault?: boolean | undefined;
      isActive?: boolean | undefined;
    }) {
      const [existing] = await db
        .select()
        .from(merchantReceivingAccounts)
        .where(
          and(
            eq(merchantReceivingAccounts.id, input.accountId),
            eq(merchantReceivingAccounts.tenantId, input.tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        return { ok: false as const, error: "receiving_account_not_found", status: 404 as const };
      }

      if (input.isDefault === true) {
        await db
          .update(merchantReceivingAccounts)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(merchantReceivingAccounts.tenantId, input.tenantId));
      }

      const patch: Partial<typeof merchantReceivingAccounts.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.bankCode !== undefined) patch.bankCode = input.bankCode?.trim() || null;
      if (input.bankName !== undefined) patch.bankName = input.bankName.trim();
      if (input.accountName !== undefined) patch.accountName = input.accountName?.trim() || null;
      if (input.label !== undefined) patch.label = input.label.trim();
      if (input.isDefault !== undefined) patch.isDefault = input.isDefault;
      if (input.isActive !== undefined) patch.isActive = input.isActive;
      if (input.accountNumber !== undefined) {
        const sealed = sealAccountNumber(input.accountNumber);
        patch.accountNumberEncrypted = sealed.encrypted;
        patch.accountLast4 = sealed.last4;
      }

      try {
        const [row] = await db
          .update(merchantReceivingAccounts)
          .set(patch)
          .where(eq(merchantReceivingAccounts.id, input.accountId))
          .returning();
        if (!row) {
          return { ok: false as const, error: "receiving_account_not_found", status: 404 as const };
        }
        return { ok: true as const, account: mapRow(row) };
      } catch {
        return { ok: false as const, error: "receiving_account_label_taken", status: 409 as const };
      }
    },

    async deleteAccount(input: { tenantId: string; accountId: string }) {
      const deleted = await db
        .delete(merchantReceivingAccounts)
        .where(
          and(
            eq(merchantReceivingAccounts.id, input.accountId),
            eq(merchantReceivingAccounts.tenantId, input.tenantId),
          ),
        )
        .returning({ id: merchantReceivingAccounts.id });

      if (!deleted[0]) {
        return { ok: false as const, error: "receiving_account_not_found", status: 404 as const };
      }
      return { ok: true as const, id: deleted[0].id, deleted: true };
    },
  };
}
