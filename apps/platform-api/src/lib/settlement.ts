/** Settlement method vocabulary for mark-paid / reporting. */

export const SETTLEMENT_METHODS = [
  "cash",
  "telebirr",
  "cbe_birr",
  "bank_transfer",
  "chapa",
  "other",
] as const;

export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

export type OrderSettlementInput = {
  method: SettlementMethod;
  bankCode?: string | null | undefined;
  bankName?: string | null | undefined;
  accountLast4?: string | null | undefined;
  accountLabel?: string | null | undefined;
  receivingAccountId?: string | null | undefined;
  reference?: string | null | undefined;
  note?: string | null | undefined;
};

export type OrderSettlement = {
  method: SettlementMethod;
  bankCode: string | null;
  bankName: string | null;
  accountLast4: string | null;
  accountLabel: string | null;
  receivingAccountId: string | null;
  reference: string | null;
  note: string | null;
  recordedAt: string | null;
};

export function isSettlementMethod(value: unknown): value is SettlementMethod {
  return typeof value === "string" && (SETTLEMENT_METHODS as readonly string[]).includes(value);
}

export function parseSettlementMethod(value: unknown): SettlementMethod | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (isSettlementMethod(key)) return key;
  if (key === "cbe" || key === "cbebirr") return "cbe_birr";
  if (key === "bank" || key === "transfer") return "bank_transfer";
  if (key === "cash_on_delivery") return "cash";
  return null;
}

/** Apply settlement fields onto Medusa order metadata (snake_case). */
export function settlementToMetadata(
  input: OrderSettlementInput,
  recordedAt = new Date().toISOString(),
): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    settlement_method: input.method,
    settlement_recorded_at: recordedAt,
  };
  if (input.bankCode?.trim()) meta.settlement_bank_code = input.bankCode.trim();
  if (input.bankName?.trim()) meta.settlement_bank_name = input.bankName.trim();
  if (input.accountLast4?.trim()) meta.settlement_account_last4 = input.accountLast4.trim();
  if (input.accountLabel?.trim()) meta.settlement_account_label = input.accountLabel.trim();
  if (input.receivingAccountId?.trim()) {
    meta.settlement_receiving_account_id = input.receivingAccountId.trim();
  }
  if (input.reference?.trim()) {
    meta.settlement_reference = input.reference.trim();
    meta.payment_reference = input.reference.trim();
  }
  if (input.note?.trim()) meta.settlement_note = input.note.trim();
  return meta;
}

export function settlementFromMetadata(
  metadata: Record<string, unknown>,
): OrderSettlement | null {
  const method = parseSettlementMethod(metadata.settlement_method);
  if (!method) return null;

  const str = (key: string) => {
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  return {
    method,
    bankCode: str("settlement_bank_code"),
    bankName: str("settlement_bank_name"),
    accountLast4: str("settlement_account_last4"),
    accountLabel: str("settlement_account_label"),
    receivingAccountId: str("settlement_receiving_account_id"),
    reference: str("settlement_reference") ?? str("payment_reference"),
    note: str("settlement_note"),
    recordedAt: str("settlement_recorded_at") ?? str("paid_at"),
  };
}

/** Static Ethiopian bank / wallet catalog (fallback when Chapa banks unavailable). */
export const ETHIOPIAN_BANK_CATALOG: Array<{ code: string; name: string }> = [
  { code: "telebirr", name: "Telebirr" },
  { code: "cbe_birr", name: "CBE Birr" },
  { code: "cbe", name: "Commercial Bank of Ethiopia" },
  { code: "awash", name: "Awash Bank" },
  { code: "dashen", name: "Dashen Bank" },
  { code: "abyssinia", name: "Bank of Abyssinia" },
  { code: "coop", name: "Cooperative Bank of Oromia" },
  { code: "wegagen", name: "Wegagen Bank" },
  { code: "united", name: "United Bank" },
  { code: "nib", name: "Nib International Bank" },
  { code: "zemen", name: "Zemen Bank" },
  { code: "hibret", name: "Hibret Bank" },
  { code: "bunna", name: "Bunna International Bank" },
  { code: "enat", name: "Enat Bank" },
  { code: "oromia", name: "Oromia Bank" },
  { code: "siinqee", name: "Siinqee Bank" },
  { code: "amhara", name: "Amhara Bank" },
  { code: "other", name: "Other bank" },
];
