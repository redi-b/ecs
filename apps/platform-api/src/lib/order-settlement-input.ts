import { type OrderSettlementInput, parseSettlementMethod } from "./settlement.js";

export function parseOrderSettlementInput(body: Record<string, unknown>): OrderSettlementInput | null {
  const nested = typeof body.settlement === "object" && body.settlement !== null
    ? body.settlement as Record<string, unknown>
    : {};
  const method = parseSettlementMethod(body.settlementMethod ?? body.method ?? nested.method);
  if (!method) return null;
  const stringValue = (key: string) => {
    const value = body[key] ?? nested[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  return {
    method,
    bankCode: stringValue("bankCode") ?? stringValue("settlementBankCode"),
    bankName: stringValue("bankName") ?? stringValue("settlementBankName"),
    accountLast4: stringValue("accountLast4") ?? stringValue("settlementAccountLast4"),
    accountLabel: stringValue("accountLabel") ?? stringValue("settlementAccountLabel"),
    receivingAccountId: stringValue("receivingAccountId") ?? stringValue("settlementReceivingAccountId"),
    reference: stringValue("reference") ?? stringValue("settlementReference") ?? stringValue("paymentReference"),
    note: stringValue("note") ?? stringValue("settlementNote"),
  };
}
