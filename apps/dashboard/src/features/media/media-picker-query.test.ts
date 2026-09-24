import assert from "node:assert/strict";
import { test } from "node:test";
import type { MediaAsset } from "@/lib/merchant-media";
import { fetchMediaPickerPage, toggleMediaSelection } from "./media-picker-query";

const asset = (id: string): MediaAsset => ({
  id,
  accessMode: "public",
  altText: null,
  byteSize: 100,
  createdAt: "2026-09-07",
  updatedAt: "2026-09-07",
  displayName: id,
  filename: id,
  width: 100,
  height: 100,
  mimeType: "image/png",
  publicUrl: `https://cdn.example/${id}`,
  status: "ready",
});

test("selection survives pages, supports deselection and enforces the cap", () => {
  let selected = toggleMediaSelection([], asset("page1"), true, 2);
  selected = toggleMediaSelection(selected, asset("page2"), true, 2);
  assert.deepEqual(
    selected.map((item) => item.id),
    ["page1", "page2"],
  );
  assert.deepEqual(toggleMediaSelection(selected, asset("third"), true, 2), selected);
  assert.deepEqual(
    toggleMediaSelection(selected, asset("page1"), true, 2).map((item) => item.id),
    ["page2"],
  );
  assert.deepEqual(
    toggleMediaSelection(selected, asset("replacement"), false).map((item) => item.id),
    ["replacement"],
  );
});

test("picker forwards page, filters and cancellation and retains total count", async () => {
  const controller = new AbortController();
  const params = new URLSearchParams({
    limit: "24",
    offset: "120",
    q: "blue",
    orientation: "portrait",
    size: "large",
    publicOnly: "true",
  });
  const result = await fetchMediaPickerPage(params, controller.signal, async (url, init) => {
    assert.equal(String(url), `/dashboard/media/assets?${params}`);
    assert.equal(init?.signal, controller.signal);
    return Response.json({ assets: [asset("last")], count: 121, limit: 24, offset: 120 });
  });
  assert.equal(result.count, 121);
});

test("picker rejects wrong pages, duplicate IDs and failed requests", async () => {
  for (const payload of [
    { assets: [], count: 1, limit: 24, offset: 24 },
    { assets: [asset("same"), asset("same")], count: 2, limit: 24, offset: 0 },
    { assets: [asset("one")], count: 0, limit: 24, offset: 0 },
  ])
    await assert.rejects(
      fetchMediaPickerPage(
        new URLSearchParams({ limit: "24", offset: "0" }),
        new AbortController().signal,
        async () => Response.json(payload),
      ),
    );
  await assert.rejects(
    fetchMediaPickerPage(
      new URLSearchParams({ limit: "24", offset: "0" }),
      new AbortController().signal,
      async () => new Response(null, { status: 503 }),
    ),
  );
});
