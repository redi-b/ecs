import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { userCalendarPreferenceSchema } from "./index.js";

describe("calendar preference contract", () => {
  it("accepts only supported account preferences", () => {
    for (const value of ["follow-language", "ethiopian", "gregorian"]) {
      assert.equal(userCalendarPreferenceSchema.parse(value), value);
    }
    for (const value of ["ethiopic", "gregory", "locale", "", null]) {
      assert.equal(userCalendarPreferenceSchema.safeParse(value).success, false);
    }
  });
});
