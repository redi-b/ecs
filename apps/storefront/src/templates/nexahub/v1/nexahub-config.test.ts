import assert from "node:assert/strict";
import test from "node:test";

import { parseNexahubData, parseNexahubThemeTokens } from "./lib";

/**
 * The trust boundary for a tenant's saved config. Every function here falls
 * back to template defaults on any parse failure and never throws, so a schema
 * key that is stricter than it needs to be turns a partial config into a whole
 * storefront silently reverting to demo copy with HTTP 200.
 *
 * These tests pin the resilience rather than the happy path.
 */

test("a saved theme survives a legacy payload missing the non-visual keys", () => {
  const tokens = parseNexahubThemeTokens({
    colors: {
      background: "#f8f8fc",
      foreground: "#262732",
      primary: "#3064d5",
      muted: "#f0f0f6",
      accent: "#b4cffd",
    },
  });
  // The brand must survive; only the unrendered flags fall back to defaults.
  assert.equal(tokens.colors.primary, "#3064d5");
  assert.equal(tokens.colorMode, "light");
  assert.equal(tokens.radius, "none");
});

test("a stored colorMode of dark does not discard the brand", () => {
  const tokens = parseNexahubThemeTokens({
    ...parseNexahubThemeTokens({}),
    colorMode: "dark",
  });
  assert.equal(tokens.colors.primary, "#3064d5");
  assert.equal(tokens.colorMode, "dark");
});

test("a saved footer section survives a payload that omits the defaulted keys", () => {
  // These five were required with no .default(), so one missing key failed the
  // whole safeParse and the tenant silently got the template's demo copy.
  const base = parseNexahubData({});
  const footer = { ...base.footer };
  delete (footer as Record<string, unknown>).quickLinks;
  delete (footer as Record<string, unknown>).socialLinks;
  delete (base.header as Record<string, unknown>).navigation;
  delete (base as Record<string, unknown>).listing;
  delete (base.home.contact as Record<string, unknown>).ctaHref;

  const data = parseNexahubData(base);
  assert.ok(Array.isArray(data.footer.quickLinks));
  assert.ok(Array.isArray(data.footer.socialLinks));
  assert.ok(Array.isArray(data.header.navigation));
  assert.ok(data.listing.title.length > 0);
  assert.equal(data.home.contact.ctaHref.length > 0, true);
});

test("a merchant-supplied value is never overwritten by the defaults", () => {
  const data = parseNexahubData({ ...parseNexahubData({}), footer: { blurb: "Kept" } });
  assert.equal(data.footer.blurb, "Kept");
});
