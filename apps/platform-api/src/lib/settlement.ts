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

/** Pinned ethiopianlogos commit for import only (runtime serves from media). */
export const ETHIOPIAN_LOGOS_COMMIT = "3308b42e045ac942e37b4be8705fe01d4e002ac0";

export const BANK_LOGO_OBJECT_PREFIX = "platform/bank-logos";

export function bankLogoObjectKey(code: string) {
  return `${BANK_LOGO_OBJECT_PREFIX}/${code}.svg`;
}

export function bankLogoPublicUrl(publicBaseUrl: string, code: string) {
  return `${publicBaseUrl.replace(/\/$/, "")}/${bankLogoObjectKey(code)}`;
}

/** Upstream SVG for `seed:bank-logos -- --fetch` only. */
export function ethiopianLogosSourceSvgUrl(logoSource: string) {
  return `https://cdn.jsdelivr.net/gh/Chapa-Et/ethiopianlogos@${ETHIOPIAN_LOGOS_COMMIT}/logos/${logoSource}/${logoSource}.svg`;
}

export type PaymentBankCatalogEntry = {
  code: string;
  name: string;
  kind: "bank" | "wallet" | "other";
  /** ethiopianlogos `logos/` folder name, or null when no asset yet. */
  logoSource: string | null;
  sortOrder: number;
};

/** Default catalog; `payment_banks` is the runtime source of truth. */
export const ETHIOPIAN_BANK_CATALOG: PaymentBankCatalogEntry[] = [
  { code: "telebirr", name: "Telebirr", kind: "wallet", logoSource: "tele_birr", sortOrder: 10 },
  {
    code: "cbe_birr",
    name: "CBE Birr",
    kind: "wallet",
    logoSource: "cbe_birr_normal",
    sortOrder: 20,
  },
  {
    code: "cbe",
    name: "Commercial Bank of Ethiopia",
    kind: "bank",
    logoSource: "commercial_bank_of_ethiopia",
    sortOrder: 30,
  },
  {
    code: "awash",
    name: "Awash Bank",
    kind: "bank",
    logoSource: "awash_international_bank",
    sortOrder: 40,
  },
  {
    code: "dashen",
    name: "Dashen Bank",
    kind: "bank",
    logoSource: "dashen_bank",
    sortOrder: 50,
  },
  {
    code: "abyssinia",
    name: "Bank of Abyssinia",
    kind: "bank",
    logoSource: "bank_of_abyssinia",
    sortOrder: 60,
  },
  {
    code: "coop",
    name: "Cooperative Bank of Oromia",
    kind: "bank",
    logoSource: "cooperative_bank_of_oromia",
    sortOrder: 70,
  },
  { code: "wegagen", name: "Wegagen Bank", kind: "bank", logoSource: null, sortOrder: 80 },
  { code: "united", name: "United Bank", kind: "bank", logoSource: null, sortOrder: 90 },
  { code: "nib", name: "Nib International Bank", kind: "bank", logoSource: null, sortOrder: 100 },
  { code: "zemen", name: "Zemen Bank", kind: "bank", logoSource: "zemen_bank", sortOrder: 110 },
  { code: "hibret", name: "Hibret Bank", kind: "bank", logoSource: "hibret_bank", sortOrder: 120 },
  { code: "bunna", name: "Bunna International Bank", kind: "bank", logoSource: null, sortOrder: 130 },
  { code: "enat", name: "Enat Bank", kind: "bank", logoSource: null, sortOrder: 140 },
  {
    code: "oromia",
    name: "Oromia Bank",
    kind: "bank",
    logoSource: "oromia_international_bank",
    sortOrder: 150,
  },
  { code: "siinqee", name: "Siinqee Bank", kind: "bank", logoSource: null, sortOrder: 160 },
  { code: "amhara", name: "Amhara Bank", kind: "bank", logoSource: "amhara_bank", sortOrder: 170 },
  { code: "amole", name: "Amole", kind: "wallet", logoSource: "amole", sortOrder: 180 },
  { code: "other", name: "Other bank", kind: "other", logoSource: null, sortOrder: 900 },
];

export function catalogBanksWithLogoUrls(
  publicBaseUrl?: string | null,
): Array<PaymentBankCatalogEntry & { logoUrl: string | null }> {
  const base = publicBaseUrl?.trim() || null;
  return ETHIOPIAN_BANK_CATALOG.map((entry) => ({
    ...entry,
    logoUrl: base && entry.logoSource ? bankLogoPublicUrl(base, entry.code) : null,
  }));
}
