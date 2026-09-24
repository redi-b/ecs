import assert from "node:assert/strict";
import { test } from "node:test";
import { listDateRangeToTimestamps, parseListDateRange } from "../../lib/list-date-range";
import {
  orderListFiltersToQuery,
  orderListFiltersToSearchParams,
  parseOrderListFilters,
} from "./order-domain";

test("custom dates round-trip through URL state and take precedence over a preset", () => {
  const filters = parseOrderListFilters({
    created: "today",
    createdFrom: "2026-09-01",
    createdTo: "2026-09-05",
    payment: "unpaid",
  });
  assert.equal(filters.created, "all");
  const query = orderListFiltersToQuery(filters);
  assert.deepEqual(query, {
    payment: "unpaid",
    createdFrom: "2026-09-01",
    createdTo: "2026-09-05",
  });
  assert.deepEqual(parseOrderListFilters(query), filters);
});

test("invalid, impossible, incomplete and reversed custom dates are not forwarded", () => {
  for (const [start, end] of [
    ["2026-02-29", "2026-03-01"],
    ["2026-09-05", "2026-09-01"],
    ["2026-09-01", ""],
    ["", "2026-09-01"],
    ["bad", "2026-09-01"],
    ["2026-9-1", "2026-09-05"],
    ["2026-09-01T00:00:00Z", "2026-09-05"],
  ]) {
    assert.equal(parseListDateRange(start, end), null);
    assert.deepEqual(
      orderListFiltersToQuery(parseOrderListFilters({ createdFrom: start, createdTo: end })),
      {},
    );
  }
});

test("same-day selection covers the entire Ethiopian calendar day", () => {
  assert.deepEqual(listDateRangeToTimestamps({ start: "2026-09-01", end: "2026-09-01" }), {
    createdFrom: "2026-08-31T21:00:00.000Z",
    createdTo: "2026-09-01T20:59:59.999Z",
  });
  assert.ok(parseListDateRange("2024-02-29", "2024-03-01"));
  assert.throws(
    () => listDateRangeToTimestamps({ start: "2026-02-29", end: "2026-03-01" }),
    RangeError,
  );
});

test("filter changes reset page, preserve tenant/customer context, and remove obsolete bounds", () => {
  const current = new URLSearchParams(
    "page=7&pageSize=20&tenantId=tenant_1&customerId=cus_1&createdFrom=2026-09-01&createdTo=2026-09-05",
  );
  const next = orderListFiltersToSearchParams(parseOrderListFilters({ created: "today" }), current);
  assert.equal(next.get("page"), null);
  assert.equal(next.get("createdFrom"), null);
  assert.equal(next.get("createdTo"), null);
  assert.equal(next.get("created"), "today");
  assert.equal(next.get("tenantId"), "tenant_1");
  assert.equal(next.get("customerId"), "cus_1");
  assert.equal(next.get("pageSize"), "20");
  assert.equal(current.get("page"), "7");
});

test("clearing the date filter removes both custom bounds without clearing other filters", () => {
  const next = orderListFiltersToSearchParams(
    parseOrderListFilters({ payment: "unpaid" }),
    new URLSearchParams("createdFrom=2026-09-01&createdTo=2026-09-05&payment=unpaid&page=4"),
  );
  assert.equal(next.toString(), "payment=unpaid");
});
