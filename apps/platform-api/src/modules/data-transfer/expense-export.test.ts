import assert from "node:assert/strict";
import { it } from "node:test";
import { buildExpenseCsv, expenseExportFilename } from "./expense-export.js";

it("exports stable minor-unit expense rows and neutralizes spreadsheet formulas", () => {
  const csv = buildExpenseCsv([
    {
      actorUserId: "user_1",
      amount: 12_550,
      category: "other",
      createdAt: "2026-09-29T10:00:00.000Z",
      currencyCode: "etb",
      id: "expense_1",
      note: '=HYPERLINK("bad")',
      occurredOn: "2026-09-29",
      reference: null,
      status: "active",
      tenantId: "tenant_1",
      updatedAt: "2026-09-29T10:00:00.000Z",
      vendorLabel: "ቡና",
      voidedAt: null,
      voidedByUserId: null,
    },
  ]);
  assert.match(csv, /amount_minor_units/);
  assert.match(csv, /12550/);
  assert.match(csv, /ቡና/);
  assert.match(csv, /'=HYPERLINK/);
  assert.equal(
    expenseExportFilename(new Date("2026-09-29T10:11:12Z")),
    "ecs-expenses-20260929T101112Z.csv",
  );
});
