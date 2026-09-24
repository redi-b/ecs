import type { MerchantOrderActionResult } from "../../../types/index.js";
import { mapMedusaFailure } from "../map-medusa-failure.js";
import { getAdminHeaders, requestMedusa } from "./medusa-http.js";
import { normalizeOrder } from "./normalize.js";
import {
  encodeRefundNote,
  getPaymentRefundedAmount,
  getPayments,
  isCapturedPayment,
  type MerchantRefundInput,
} from "./refunds.js";
import {
  getEnsureOrderPaymentUrl,
  getOrderUrl,
  getPaymentCaptureUrl,
  getPaymentRefundUrl,
} from "./urls.js";
import { getNumber, getString, isRecord } from "./values.js";

export async function refundMerchantOrder(
  fetcher: typeof fetch,
  options: { adminApiToken?: string | undefined; medusaInternalUrl: string },
  input: {
    orderId: string;
    salesChannelId: string;
    refund: MerchantRefundInput;
  },
): Promise<MerchantOrderActionResult> {
  if (!Number.isFinite(input.refund.amount) || input.refund.amount <= 0) {
    return { ok: false, error: "order_refund_amount_invalid", status: 400 };
  }

  const orderResponse = await requestMedusa(
    fetcher,
    getOrderUrl(options.medusaInternalUrl, input),
    { headers: getAdminHeaders(options.adminApiToken ?? "") },
  );
  if (!orderResponse.ok) {
    return (await mapMedusaFailure(orderResponse)) as Extract<
      MerchantOrderActionResult,
      { ok: false }
    >;
  }
  let orderData = await orderResponse.json().catch(() => undefined);
  let normalized = normalizeOrder(orderData?.order, input.salesChannelId)[0];
  if (!normalized || !isRecord(orderData?.order)) {
    return { ok: false, error: "order_not_found", status: 404 };
  }

  let payment = getPayments(orderData.order).find((candidate) => {
    if (!isCapturedPayment(candidate)) return false;
    const remaining = (getNumber(candidate.amount) ?? 0) - getPaymentRefundedAmount(candidate);
    return remaining + Number.EPSILON >= input.refund.amount;
  });
  if (!payment && normalized.paymentStatus?.toLowerCase().match(/paid|captured|refund/)) {
    for (const candidate of getPayments(orderData.order)) {
      const candidateId = getString(candidate.id);
      if (!candidateId || isCapturedPayment(candidate)) continue;
      await requestMedusa(fetcher, getPaymentCaptureUrl(options.medusaInternalUrl, candidateId), {
        body: JSON.stringify({}),
        headers: getAdminHeaders(options.adminApiToken ?? ""),
        method: "POST",
      });
    }
    const repaired = await requestMedusa(
      fetcher,
      getEnsureOrderPaymentUrl(options.medusaInternalUrl, input.orderId),
      {
        body: JSON.stringify({}),
        headers: getAdminHeaders(options.adminApiToken ?? ""),
        method: "POST",
      },
    );
    if (!repaired.ok) {
      return (await mapMedusaFailure(repaired, {
        invalidError: "order_refund_amount_invalid",
      })) as Extract<MerchantOrderActionResult, { ok: false }>;
    }
    const repairedOrder = await requestMedusa(
      fetcher,
      getOrderUrl(options.medusaInternalUrl, input),
      { headers: getAdminHeaders(options.adminApiToken ?? "") },
    );
    orderData = await repairedOrder.json().catch(() => undefined);
    normalized = normalizeOrder(orderData?.order, input.salesChannelId)[0] ?? normalized;
    payment = isRecord(orderData?.order)
      ? getPayments(orderData.order).find((candidate) => {
          if (!isCapturedPayment(candidate)) return false;
          const remaining =
            (getNumber(candidate.amount) ?? 0) - getPaymentRefundedAmount(candidate);
          return remaining + Number.EPSILON >= input.refund.amount;
        })
      : undefined;
  }
  const paymentId = payment ? getString(payment.id) : null;
  if (!paymentId) {
    return { ok: false, error: "order_refund_amount_invalid", status: 409 };
  }

  const response = await requestMedusa(
    fetcher,
    getPaymentRefundUrl(options.medusaInternalUrl, paymentId),
    {
      body: JSON.stringify({
        amount: input.refund.amount,
        note: encodeRefundNote(input.refund),
      }),
      headers: getAdminHeaders(options.adminApiToken ?? ""),
      method: "POST",
    },
  );
  if (!response.ok) {
    return (await mapMedusaFailure(response, {
      invalidError: "order_refund_amount_invalid",
    })) as Extract<MerchantOrderActionResult, { ok: false }>;
  }

  const refreshed = await requestMedusa(fetcher, getOrderUrl(options.medusaInternalUrl, input), {
    headers: getAdminHeaders(options.adminApiToken ?? ""),
  });
  if (!refreshed.ok) return { ok: true, order: normalized };
  const refreshedData = await refreshed.json().catch(() => undefined);
  const order = normalizeOrder(refreshedData?.order, input.salesChannelId)[0];
  return order ? { ok: true, order } : { ok: true, order: normalized };
}
