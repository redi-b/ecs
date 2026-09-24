import assert from "node:assert/strict";
import test from "node:test";
import * as m from "../paraglide/messages.js";
import { formatStorefrontDate } from "./date.js";
import { formatMoney } from "./money.js";

test("formats ETB and dates for the selected storefront language", () => {
  assert.match(formatMoney(1234.5, "ETB", "en"), /ETB/);
  assert.match(formatMoney(1234.5, "ETB", "am"), /ብር/);
  assert.match(formatStorefrontDate("2026-09-18T12:00:00Z", "en") ?? "", /Sep/);
  assert.match(formatStorefrontDate("2026-09-18T12:00:00Z", "am") ?? "", /ሴፕቴ/);
});

test("uses explicit singular and plural customer copy in both languages", () => {
  assert.equal(m.account_item_count({ count: 1 }, { locale: "en" }), "1 item");
  assert.equal(m.account_item_count_plural({ count: 2 }, { locale: "en" }), "2 items");
  assert.equal(m.account_item_count({ count: 1 }, { locale: "am" }), "1 ምርት");
  assert.equal(m.account_item_count_plural({ count: 2 }, { locale: "am" }), "2 ምርቶች");
});
