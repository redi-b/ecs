import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  customerSessionClearCookie,
  customerSessionSetCookie,
  getCustomerTokenFromRequest,
} from "./customer-cookie.js";

describe("customer session cookie", () => {
  it("is HttpOnly and same-site", () => {
    const cookie = customerSessionSetCookie("signed.jwt");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.equal(
      getCustomerTokenFromRequest(new Request("http://shop.test", { headers: { cookie: cookie.split(";", 1)[0]! } })),
      "signed.jwt",
    );
  });

  it("can be cleared", () => assert.match(customerSessionClearCookie(), /Max-Age=0/));
});
