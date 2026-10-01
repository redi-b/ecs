import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosCartSurface } from "./pos-cart-surface";

const props = {
  title: "Current sale",
  mobileOpen: false,
  busy: false,
  triggerRef: { current: null },
  onCloseMobile: () => undefined,
  children: createElement("button", { type: "button" }, "Checkout"),
};
test("desktop has one named cart region with checkout", () => {
  const html = renderToStaticMarkup(createElement(PosCartSurface, { ...props, desktop: true }));
  assert.match(html, /<aside aria-label="Current sale"/);
  assert.equal(html.match(/Checkout/g)?.length, 1);
});
test("closed mobile cart does not leave offscreen checkout controls in the document", () => {
  const html = renderToStaticMarkup(createElement(PosCartSurface, { ...props, desktop: false }));
  assert.doesNotMatch(html, /Checkout|<aside/);
});
