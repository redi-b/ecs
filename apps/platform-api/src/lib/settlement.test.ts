import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseSettlementMethod,
  settlementFromMetadata,
  settlementToMetadata,
} from "./settlement.js";

describe("settlement helpers", () => {
  it("parses settlement method aliases", () => {
    assert.equal(parseSettlementMethod("cash"), "cash");
    assert.equal(parseSettlementMethod("CBE Birr"), "cbe_birr");
    assert.equal(parseSettlementMethod("bank-transfer"), "bank_transfer");
    assert.equal(parseSettlementMethod("nope"), null);
  });

  it("round-trips metadata", () => {
    const meta = settlementToMetadata({
      method: "bank_transfer",
      bankName: "CBE",
      accountLast4: "4521",
      reference: "FT99",
    });
    const settlement = settlementFromMetadata(meta);
    assert.equal(settlement?.method, "bank_transfer");
    assert.equal(settlement?.bankName, "CBE");
    assert.equal(settlement?.accountLast4, "4521");
    assert.equal(settlement?.reference, "FT99");
  });
});
