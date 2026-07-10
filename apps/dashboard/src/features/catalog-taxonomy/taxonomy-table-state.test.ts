import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";

import {
  filterCategoriesForTable,
  filterCollectionsForTable,
  formatTaxonomyDate,
  getCategoryDisplayName,
  getCollectionDisplayName,
  getTaxonomyTableCounts,
  slugifyTaxonomyHandle,
} from "./taxonomy-table-state.js";

const collections: MerchantProductCollection[] = [
  {
    id: "pcol_coffee",
    title: "Coffee picks",
    handle: "coffee-picks",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "pcol_tea",
    title: null,
    handle: "tea-leaves",
    createdAt: null,
    updatedAt: null,
  },
];

const categories: MerchantProductCategory[] = [
  {
    id: "pcat_beans",
    name: "Beans",
    handle: "beans",
    isActive: true,
    isInternal: false,
    parentCategoryId: "pcat_pantry",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
  },
  {
    id: "pcat_tools",
    name: null,
    handle: "brew-tools",
    isActive: true,
    isInternal: false,
    parentCategoryId: null,
    createdAt: null,
    updatedAt: null,
  },
];

const coffeeCollection = collections[0];
const teaCollection = collections[1];
const beansCategory = categories[0];
const toolsCategory = categories[1];

assert.ok(coffeeCollection);
assert.ok(teaCollection);
assert.ok(beansCategory);
assert.ok(toolsCategory);

describe("taxonomy table state", () => {
  it("searches collections by id, title, and handle", () => {
    assert.deepEqual(
      filterCollectionsForTable(collections, { query: "pcol_coffee" }).map(
        (collection) => collection.id,
      ),
      ["pcol_coffee"],
    );
    assert.deepEqual(
      filterCollectionsForTable(collections, { query: "coffee picks" }).map(
        (collection) => collection.id,
      ),
      ["pcol_coffee"],
    );
    assert.deepEqual(
      filterCollectionsForTable(collections, { query: "tea-leaves" }).map(
        (collection) => collection.id,
      ),
      ["pcol_tea"],
    );
  });

  it("searches categories by id, name, handle, and parent id", () => {
    assert.deepEqual(
      filterCategoriesForTable(categories, { query: "pcat_beans" }).map((category) => category.id),
      ["pcat_beans"],
    );
    assert.deepEqual(
      filterCategoriesForTable(categories, { query: "beans" }).map((category) => category.id),
      ["pcat_beans"],
    );
    assert.deepEqual(
      filterCategoriesForTable(categories, { query: "brew-tools" }).map((category) => category.id),
      ["pcat_tools"],
    );
    assert.deepEqual(
      filterCategoriesForTable(categories, { query: "pcat_pantry" }).map((category) => category.id),
      ["pcat_beans"],
    );
  });

  it("keeps all taxonomy rows for whitespace-only queries", () => {
    assert.deepEqual(
      filterCollectionsForTable(collections, { query: "   " }).map((collection) => collection.id),
      ["pcol_coffee", "pcol_tea"],
    );
    assert.deepEqual(
      filterCategoriesForTable(categories, { query: "   " }).map((category) => category.id),
      ["pcat_beans", "pcat_tools"],
    );
  });

  it("derives active filter count state from the query", () => {
    assert.deepEqual(
      getTaxonomyTableCounts({
        filteredCount: 1,
        pageCount: 2,
        query: "coffee",
        totalCount: 9,
      }),
      {
        filteredCount: 1,
        hasActiveFilter: true,
        pageCount: 2,
        totalCount: 9,
      },
    );
    assert.deepEqual(
      getTaxonomyTableCounts({
        filteredCount: 2,
        pageCount: 2,
        query: "   ",
        totalCount: 2,
      }),
      {
        filteredCount: 2,
        hasActiveFilter: false,
        pageCount: 2,
        totalCount: 2,
      },
    );
  });

  it("formats valid dates and falls back for null or invalid dates", () => {
    assert.equal(formatTaxonomyDate("2026-07-01T00:00:00.000Z"), "Jul 1, 2026");
    assert.equal(formatTaxonomyDate(null), "No date");
    assert.equal(formatTaxonomyDate("not-a-date"), "No date");
  });

  it("uses title/name display labels before handle and id fallbacks", () => {
    assert.equal(getCollectionDisplayName(coffeeCollection), "Coffee picks");
    assert.equal(getCollectionDisplayName(teaCollection), "tea-leaves");
    assert.equal(getCollectionDisplayName({ ...teaCollection, handle: null }), "pcol_tea");
    assert.equal(getCategoryDisplayName(beansCategory), "Beans");
    assert.equal(getCategoryDisplayName(toolsCategory), "brew-tools");
    assert.equal(getCategoryDisplayName({ ...toolsCategory, handle: null }), "pcat_tools");
  });

  it("slugifies taxonomy handles", () => {
    assert.equal(slugifyTaxonomyHandle(" Coffee Beans "), "coffee-beans");
    assert.equal(slugifyTaxonomyHandle("Fresh & Seasonal!"), "fresh-seasonal");
    assert.equal(slugifyTaxonomyHandle("already--slugged"), "already-slugged");
    assert.equal(slugifyTaxonomyHandle("  "), "");
  });
});
