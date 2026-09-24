import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EcsArtwork } from "./ecs-brand";

const kinds = [
  "empty",
  "products",
  "orders",
  "customers",
  "media",
  "categories",
  "collections",
  "promotions",
  "inquiries",
  "storefront",
] as const;

it("renders distinct inline scenes with shared geometry and decorative semantics", () => {
  const scenes = kinds.map((kind) => renderToStaticMarkup(createElement(EcsArtwork, { kind })));
  assert.equal(new Set(scenes).size, kinds.length);
  for (const scene of scenes) {
    assert.match(scene, /viewBox="0 0 104 104"/);
    assert.match(scene, /aria-hidden="true"/);
    assert.doesNotMatch(scene, /<img/);
    assert.match(scene, /size-28/);
  }
});

it("defaults to neutral artwork and supports a smaller secondary presentation", () => {
  const render = (props: ComponentProps<typeof EcsArtwork>) =>
    renderToStaticMarkup(createElement(EcsArtwork, props));
  assert.equal(render({}), render({ kind: "empty" }));
  assert.match(render({ size: "compact" }), /size-16/);
  assert.match(render({ size: "compact" }), /size-14/);
});
