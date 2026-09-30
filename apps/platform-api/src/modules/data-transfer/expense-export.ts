import type { MerchantExpense } from "@ecs/contracts";

export const EXPENSE_CSV_SCHEMA_VERSION = "ecs-expenses-v1";
export const MAX_EXPENSE_EXPORT_COUNT = 10_000;

function cell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildExpenseCsv(expenses: MerchantExpense[]) {
  const rows = expenses.map((expense) => [
    EXPENSE_CSV_SCHEMA_VERSION,
    expense.id,
    expense.occurredOn,
    expense.amount,
    expense.currencyCode,
    expense.category,
    expense.vendorLabel,
    expense.reference,
    expense.note,
    expense.status,
    expense.createdAt,
    expense.voidedAt,
  ]);
  const headers = [
    "schema_version",
    "expense_id",
    "occurred_on",
    "amount_minor_units",
    "currency_code",
    "category",
    "vendor_label",
    "reference",
    "note",
    "status",
    "created_at",
    "voided_at",
  ];
  return `\uFEFF${[headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

export function expenseExportFilename(date = new Date()) {
  return `ecs-expenses-${date.toISOString().replaceAll(/[-:]/g, "").slice(0, 15)}Z.csv`;
}
