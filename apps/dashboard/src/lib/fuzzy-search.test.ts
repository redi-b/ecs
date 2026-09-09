import assert from "node:assert/strict";
import test from "node:test";
import { fuzzyMatches, rankFuzzyItems } from "./fuzzy-search";

test("fuzzy search tolerates common typing mistakes", () => {
  assert.equal(fuzzyMatches("Categories", "catgories"), true);
  assert.equal(fuzzyMatches("Essential Crew Tee", "essentail tee"), true);
  assert.equal(fuzzyMatches("Awaiting payment", "inventory"), false);
});

test("fuzzy search keeps exact and prefix matches ahead of looser matches", () => {
  const values = ["Oversized", "Regular", "Size", "Sisal bag"];
  assert.deepEqual(
    rankFuzzyItems(values, "size", (value) => value),
    ["Size", "Oversized"],
  );
});

test("fuzzy search preserves source order when scores tie", () => {
  const values = ["Red shirt", "Red shoes", "Red bag"];
  assert.deepEqual(
    rankFuzzyItems(values, "red", (value) => value),
    values,
  );
});
