import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCalendarMonths,
  formatCalendarDate,
  formatDualCalendarDate,
  fromEthiopianDateParts,
  getCalendarDateParts,
  getCalendarLocale,
  getCalendarMonthBounds,
  resolveCalendarSystem,
  toCanonicalIsoInstant,
} from "./index.js";

describe("calendar foundation", () => {
  it("uses Ethiopian calendar for Amharic and Gregorian for English", () => {
    assert.equal(resolveCalendarSystem("am"), "ethiopic");
    assert.equal(resolveCalendarSystem("en"), "gregory");
    assert.equal(getCalendarLocale("am"), "am-ET-u-ca-ethiopic");
    assert.equal(getCalendarLocale("en"), "en-ET-u-ca-gregory");
  });

  it("converts a Gregorian instant to Ethiopian calendar parts", () => {
    assert.deepEqual(
      getCalendarDateParts("2026-09-24T09:00:00.000Z", {
        calendar: "ethiopic",
        locale: "en",
      }),
      { calendar: "ethiopic", day: 14, era: "AM", month: 1, year: 2019 },
    );
  });

  it("uses an unambiguous Ethiopian era label in English", () => {
    const label = formatCalendarDate("2026-09-24T09:00:00.000Z", {
      calendar: "ethiopic",
      locale: "en",
    });
    assert.equal(label, "Meskerem 14, 2019 ዓ.ም.");
    assert.doesNotMatch(label ?? "", /\bAM\b/);
  });

  it("puts the month before the day in Amharic Ethiopian dates", () => {
    assert.equal(
      formatCalendarDate("2026-09-24T09:00:00.000Z", {
        calendar: "ethiopic",
        locale: "am",
      }),
      "መስከረም 14 2019 ዓ.ም.",
    );
  });

  it("keeps persistence values as canonical ISO instants", () => {
    assert.equal(toCanonicalIsoInstant("2026-09-24T12:00:00+03:00"), "2026-09-24T09:00:00.000Z");
    assert.equal(toCanonicalIsoInstant("not-a-date"), null);
  });

  it("returns null instead of rendering invalid dates", () => {
    assert.equal(formatCalendarDate("not-a-date", { locale: "am" }), null);
  });

  it("handles Ethiopian New Year, Pagumen, and Addis Ababa midnight", () => {
    assert.deepEqual(
      getCalendarDateParts("2026-09-10T20:59:59.000Z", { locale: "en", calendar: "ethiopic" }),
      { calendar: "ethiopic", day: 5, era: "AM", month: 13, year: 2018 },
    );
    assert.deepEqual(
      getCalendarDateParts("2026-09-10T21:00:00.000Z", { locale: "en", calendar: "ethiopic" }),
      { calendar: "ethiopic", day: 1, era: "AM", month: 1, year: 2019 },
    );
    assert.deepEqual(
      getCalendarDateParts("2027-09-11T09:00:00.000Z", { locale: "en", calendar: "ethiopic" }),
      { calendar: "ethiopic", day: 6, era: "AM", month: 13, year: 2019 },
    );
  });

  it("can present an equivalent date without changing the stored instant", () => {
    const result = formatDualCalendarDate("2026-09-24T09:00:00.000Z", {
      locale: "en",
      primary: "gregory",
    });
    assert.equal(result?.primary, "gregory");
    assert.equal(result?.secondary, "ethiopic");
    assert.match(result?.primaryLabel ?? "", /2026/);
    assert.match(result?.secondaryLabel ?? "", /2019/);
  });

  it("round-trips Ethiopian input across ordinary, leap, and Pagumen dates", () => {
    for (const year of [2011, 2015, 2019, 2023]) {
      for (const month of [1, 6, 12, 13]) {
        for (const day of month === 13 ? [1, 5] : [1, 15, 30]) {
          const date = fromEthiopianDateParts({ day, month, year });
          assert.ok(date, `expected ${year}/${month}/${day} to be valid`);
          const parts = getCalendarDateParts(date, { calendar: "ethiopic", locale: "en" });
          assert.deepEqual(parts && { day: parts.day, month: parts.month, year: parts.year }, {
            day,
            month,
            year,
          });
        }
      }
    }
    assert.equal(fromEthiopianDateParts({ day: 7, month: 13, year: 2019 }), null);
  });

  it("navigates Ethiopian months without changing canonical date storage", () => {
    const pagumen = addCalendarMonths("2027-08-07T09:00:00.000Z", 1, {
      calendar: "ethiopic",
      locale: "en",
    });
    const parts = pagumen && getCalendarDateParts(pagumen, { calendar: "ethiopic", locale: "en" });
    assert.deepEqual(parts && { month: parts.month, year: parts.year }, { month: 13, year: 2019 });
    const bounds = pagumen && getCalendarMonthBounds(pagumen, { calendar: "ethiopic" });
    assert.ok(bounds);
    const end = getCalendarDateParts(bounds.end, { calendar: "ethiopic", locale: "en" });
    assert.deepEqual(end && { day: end.day, month: end.month, year: end.year }, {
      day: 6,
      month: 13,
      year: 2019,
    });
  });
});
