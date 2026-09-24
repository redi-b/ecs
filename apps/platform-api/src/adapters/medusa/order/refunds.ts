import type {
  MerchantOrderRefund,
  MerchantOrderRefundReason,
  MerchantOrderSettlementMethod,
} from "@ecs/contracts";
import { getNumber, getString, isRecord } from "./values.js";

const REFUND_NOTE_PREFIX = "ECS_REFUND_V1:";

export type MerchantRefundInput = {
  amount: number;
  method: MerchantOrderSettlementMethod;
  reason: MerchantOrderRefundReason;
  reference?: string | null | undefined;
  note?: string | null | undefined;
};

type EncodedRefundDetails = Omit<MerchantRefundInput, "amount">;

export function encodeRefundNote(input: MerchantRefundInput) {
  const details: EncodedRefundDetails = {
    method: input.method,
    reason: input.reason,
    ...(input.reference?.trim() ? { reference: input.reference.trim() } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  return `${REFUND_NOTE_PREFIX}${Buffer.from(JSON.stringify(details)).toString("base64url")}`;
}

export function decodeRefundNote(value: unknown): EncodedRefundDetails | null {
  const encoded = getString(value);
  if (!encoded?.startsWith(REFUND_NOTE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded.slice(REFUND_NOTE_PREFIX.length), "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const method = getString(parsed.method) as MerchantOrderSettlementMethod | null;
    const reason = getString(parsed.reason) as MerchantOrderRefundReason | null;
    if (!method || !reason) return null;
    return {
      method,
      reason,
      ...(getString(parsed.reference) ? { reference: getString(parsed.reference) } : {}),
      ...(getString(parsed.note) ? { note: getString(parsed.note) } : {}),
    };
  } catch {
    return null;
  }
}

export function getPayments(order: Record<string, unknown>) {
  const collections = Array.isArray(order.payment_collections) ? order.payment_collections : [];
  return collections.flatMap((collection) => {
    if (!isRecord(collection) || !Array.isArray(collection.payments)) return [];
    return collection.payments.filter(isRecord);
  });
}

export function getPaymentRefundedAmount(payment: Record<string, unknown>) {
  const direct = getNumber(payment.refunded_amount);
  if (typeof direct === "number") return direct;
  if (!Array.isArray(payment.refunds)) return 0;
  return payment.refunds.reduce(
    (sum, refund) => sum + (isRecord(refund) ? (getNumber(refund.amount) ?? 0) : 0),
    0,
  );
}

export function isCapturedPayment(payment: Record<string, unknown>) {
  return (
    Boolean(getString(payment.captured_at)) ||
    (Array.isArray(payment.captures) && payment.captures.length > 0)
  );
}

export function getOrderRefundSummary(order: Record<string, unknown>): {
  refundableTotal: number;
  refundedTotal: number;
  refunds: MerchantOrderRefund[];
} | null {
  const payments = getPayments(order);
  if (!payments.length) return null;

  const refunds = payments.flatMap((payment) => {
    if (!Array.isArray(payment.refunds)) return [];
    return payment.refunds.flatMap((refund): MerchantOrderRefund[] => {
      if (!isRecord(refund)) return [];
      const id = getString(refund.id);
      const amount = getNumber(refund.amount);
      if (!id || typeof amount !== "number" || amount <= 0) return [];
      const details = decodeRefundNote(refund.note);
      return [
        {
          id,
          amount,
          method: details?.method ?? null,
          reason: details?.reason ?? null,
          reference: details?.reference ?? null,
          note: details?.note ?? (details ? null : getString(refund.note)),
          createdAt: getString(refund.created_at),
        },
      ];
    });
  });
  const refundedTotal = refunds.reduce((sum, refund) => sum + refund.amount, 0);
  const refundableTotal = payments.reduce((sum, payment) => {
    if (!isCapturedPayment(payment)) return sum;
    return sum + Math.max(0, (getNumber(payment.amount) ?? 0) - getPaymentRefundedAmount(payment));
  }, 0);

  return { refundableTotal, refundedTotal, refunds };
}
