import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MediaAsset } from "@/lib/merchant-media";
import {
  filterAndSortMediaAssets,
  formatBytes,
  hasActiveMediaFilters,
  matchesOrientationFilter,
  matchesSizeFilter,
} from "./media-helpers";

function asset(partial: Partial<MediaAsset> & Pick<MediaAsset, "id" | "displayName">): MediaAsset {
  return {
    accessMode: "public",
    altText: null,
    byteSize: 50_000,
    createdAt: "2026-01-02T00:00:00.000Z",
    filename: `${partial.displayName}.jpg`,
    height: 800,
    mimeType: "image/jpeg",
    publicUrl: "https://example.com/a.jpg",
    status: "ready",
    updatedAt: "2026-01-02T00:00:00.000Z",
    width: 1200,
    ...partial,
  };
}

describe("media helpers", () => {
  it("formats byte sizes", () => {
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(2048), "2 KB");
    assert.equal(formatBytes(2_500_000), "2.4 MB");
  });

  it("filters by size and orientation", () => {
    const landscape = asset({
      byteSize: 50_000,
      displayName: "wide",
      height: 600,
      id: "1",
      width: 1200,
    });
    const largeSquare = asset({
      byteSize: 2_000_000,
      displayName: "square",
      height: 1000,
      id: "2",
      width: 1000,
    });

    assert.equal(matchesSizeFilter(landscape, "small"), true);
    assert.equal(matchesSizeFilter(largeSquare, "large"), true);
    assert.equal(matchesOrientationFilter(landscape, "landscape"), true);
    assert.equal(matchesOrientationFilter(largeSquare, "square"), true);
  });

  it("filters, sorts, and reports active filters", () => {
    const assets = [
      asset({
        createdAt: "2026-01-01T00:00:00.000Z",
        displayName: "Banana",
        id: "b",
        mimeType: "image/png",
      }),
      asset({
        createdAt: "2026-02-01T00:00:00.000Z",
        displayName: "Apple",
        id: "a",
        mimeType: "image/jpeg",
      }),
    ];

    const sorted = filterAndSortMediaAssets(assets, {
      orientation: "all",
      query: "",
      size: "all",
      sort: "name_asc",
      type: "all",
    });
    assert.deepEqual(
      sorted.map((item) => item.id),
      ["a", "b"],
    );

    const filtered = filterAndSortMediaAssets(assets, {
      orientation: "all",
      query: "ban",
      size: "all",
      sort: "newest",
      type: "image/png",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, "b");

    assert.equal(
      hasActiveMediaFilters({
        orientation: "all",
        query: "",
        size: "all",
        sort: "newest",
        type: "all",
      }),
      false,
    );
    assert.equal(
      hasActiveMediaFilters({
        orientation: "portrait",
        query: "",
        size: "all",
        sort: "newest",
        type: "all",
      }),
      true,
    );
  });
});
