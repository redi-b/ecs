import assert from "node:assert/strict";
import { test } from "node:test";
import { inquiryListFiltersSchema } from "./inquiry-list-query.js";

test("inquiry filtering rejects invalid dates, reversed ranges and unknown states", () => {
  for (const value of [
    { status: "pending" },
    { type: "unknown" },
    { createdFrom: "yesterday" },
    { createdFrom: "2026-09-07T00:00:00Z", createdTo: "2026-09-06T00:00:00Z" },
  ])
    assert.equal(inquiryListFiltersSchema.safeParse(value).success, false);
  assert.equal(
    inquiryListFiltersSchema.safeParse({
      status: "new",
      type: "product_request",
      createdFrom: "2026-09-07T00:00:00+03:00",
    }).success,
    true,
  );
});
