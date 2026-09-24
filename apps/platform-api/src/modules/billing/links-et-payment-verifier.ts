import { createHash } from "node:crypto";

import type {
  BillingPaymentVerificationInput,
  BillingPaymentVerificationResult,
  BillingPaymentVerifier,
} from "./payment-verification.js";

const LINKS_ET_VERIFY_URL = "https://links.et/api/verify";
const RECEIPT_HOSTS: Record<string, Set<string>> = {
  cbe: new Set(["apps.cbe.com.et", "mb.cbe.com.et", "mbreciept.cbe.com.et"]),
  telebirr: new Set(["transactioninfo.ethiotelecom.et"]),
};

type LinksEtEnvelope = {
  ok?: unknown;
  providerKey?: unknown;
  receipt?: unknown;
  error?: unknown;
};

export function createLinksEtBillingPaymentVerifier(input: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): BillingPaymentVerifier {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = Math.min(Math.max(input.timeoutMs ?? 12_000, 1_000), 30_000);

  return {
    id: "links_et",
    supports: (payment) =>
      Boolean(input.apiKey.trim()) &&
      payment.approvedRecipients.length > 0 &&
      (payment.provider === "telebirr" || payment.provider === "cbe") &&
      isAcceptedLinksEtReference(payment.provider, payment.reference),
    verify: async (payment) => {
      const request = linksEtRequest(payment.provider, payment.reference);
      if (!request) return { decision: "inconclusive" };

      try {
        const response = await fetchImpl(LINKS_ET_VERIFY_URL, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "idempotency-key": `ecs-billing-${payment.invoiceId}-${referenceDigest(payment.reference)}`,
            "x-api-key": input.apiKey.trim(),
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status === 202 || response.status === 429 || response.status >= 500) {
          return { decision: "inconclusive" };
        }
        const payload = (await response.json().catch(() => null)) as LinksEtEnvelope | null;
        if (!response.ok || payload?.ok !== true || !isRecord(payload.receipt)) {
          return response.status === 400
            ? {
                decision: "rejected" as const,
                details: { reason: "receipt_not_supported_or_invalid" },
                source: "links_et",
              }
            : { decision: "inconclusive" as const };
        }
        return matchVerifiedReceipt(payment, payload);
      } catch {
        return { decision: "inconclusive" };
      }
    },
  };
}

function matchVerifiedReceipt(
  payment: BillingPaymentVerificationInput,
  payload: LinksEtEnvelope,
): BillingPaymentVerificationResult {
  const receipt = payload.receipt as Record<string, unknown>;
  const responseHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const provider = stringValue(payload.providerKey).toLowerCase();
  if (provider !== payment.provider) {
    return rejected("provider_mismatch", "", responseHash);
  }

  const source = stringValue(receipt.source);
  const canonicalReference =
    stringValue(receipt.receiptNo) ||
    stringValue(receipt.reference) ||
    stringValue(receipt.transactionReference);
  if (!canonicalReference) return needsReview("canonical_reference_missing", source, responseHash);

  if (provider === "telebirr") {
    const status = stringValue(receipt.transactionStatus).toLowerCase();
    if (status !== "completed") return rejected("transaction_not_completed", source, responseHash);
  }

  const receivedAmount =
    provider === "telebirr"
      ? amountValue(receipt.settledAmount)
      : amountValue(receipt.transferredAmount ?? receipt.creditAmount);
  const expectedAmount = amountValue(payment.amount);
  if (receivedAmount == null || expectedAmount == null) {
    return needsReview("amount_missing", source, responseHash);
  }
  if (Math.abs(receivedAmount - expectedAmount) > 0.009) {
    return rejected("amount_mismatch", source, responseHash);
  }

  const currency = stringValue(receipt.currency).toUpperCase() || "ETB";
  if (currency !== payment.currency.toUpperCase()) {
    return rejected("currency_mismatch", source, responseHash);
  }

  const recipientName =
    provider === "telebirr"
      ? stringValue(receipt.creditedPartyName)
      : stringValue(receipt.receiverName);
  const recipientAccount =
    provider === "telebirr"
      ? stringValue(receipt.creditedPartyAccountNo)
      : stringValue(receipt.receiverAccount);
  if (!recipientMatches(payment.approvedRecipients, recipientName, recipientAccount)) {
    return rejected("recipient_mismatch", source, responseHash);
  }

  const paidAt = parseReceiptDate(receipt.paymentDate);
  if (!paidAt) return needsReview("payment_date_missing", source, responseHash);
  if (paidAt.getTime() < payment.issuedAt.getTime() - 5 * 60 * 1000) {
    return rejected("payment_predates_invoice", source, responseHash);
  }

  return {
    decision: "verified",
    details: {
      amount: receivedAmount,
      currency,
      paidAt: paidAt.toISOString(),
      provider,
      responseHash,
      source,
    },
    providerReference: canonicalReference,
    source: "links_et",
  };
}

function rejected(
  reason: string,
  receiptSource?: string,
  responseHash?: string,
): BillingPaymentVerificationResult {
  return {
    decision: "rejected",
    details: {
      reason,
      ...(receiptSource ? { receiptSource } : {}),
      ...(responseHash ? { responseHash } : {}),
    },
    source: "links_et",
  };
}

function needsReview(
  reason: string,
  receiptSource?: string,
  responseHash?: string,
): BillingPaymentVerificationResult {
  return {
    decision: "needs_review",
    details: {
      reason,
      ...(receiptSource ? { receiptSource } : {}),
      ...(responseHash ? { responseHash } : {}),
    },
    source: "links_et",
  };
}

function linksEtRequest(provider: string, value: string) {
  const reference = value.trim();
  if (provider === "telebirr" && /^[a-z0-9]{8,14}$/i.test(reference)) {
    return { reference: reference.toUpperCase() };
  }
  try {
    const url = new URL(reference);
    if (url.protocol !== "https:" || !RECEIPT_HOSTS[provider]?.has(url.hostname.toLowerCase())) {
      return null;
    }
    url.username = "";
    url.password = "";
    url.hash = "";
    return { url: url.toString() };
  } catch {
    return null;
  }
}

export function isAcceptedLinksEtReference(provider: string, value: string) {
  return linksEtRequest(provider, value) != null;
}

function recipientMatches(
  approved: BillingPaymentVerificationInput["approvedRecipients"],
  receiptName: string,
  receiptAccount: string,
) {
  return approved.some((recipient) => {
    const nameMatches =
      normalizeName(receiptName) !== "" &&
      normalizeName(receiptName) === normalizeName(recipient.accountName);
    const accountMatches = maskedAccountMatches(receiptAccount, recipient.accountNumber);
    return nameMatches || accountMatches;
  });
}

function maskedAccountMatches(masked: string, full: string) {
  const maskedValue = masked.replace(/[^a-z0-9*]/gi, "").toLowerCase();
  const fullValue = full.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!maskedValue || !fullValue) return false;
  if (!maskedValue.includes("*")) return maskedValue === fullValue;
  const [prefix = "", ...rest] = maskedValue.split("*");
  const suffix = rest.at(-1) ?? "";
  return (
    prefix.length >= 1 &&
    suffix.length >= 4 &&
    fullValue.startsWith(prefix) &&
    fullValue.endsWith(suffix)
  );
}

function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function amountValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

function parseReceiptDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+03:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const direct = new Date(value);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function referenceDigest(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex").slice(0, 24);
}
