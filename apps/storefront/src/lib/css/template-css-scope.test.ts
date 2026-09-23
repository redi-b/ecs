import assert from "node:assert/strict";
import test from "node:test";
import { prefixSelectorList, scopeCssText, splitSelectorList, templateScopeFromId } from "./template-css-scope";

test("prefixes simple rules and keeps :root/html targeting the scoped root", () => {
  const css = `
:root { --x: 1; }
html { box-sizing: border-box; }
body { margin: 0; }
.hero-section { color: red; }
.a, .b { color: blue; }
`;
  const out = scopeCssText(css, ".template-luvia");
  assert.match(out, /\.template-luvia\s*\{\s*--x: 1; \}/);
  assert.match(out, /\.template-luvia\s*\{\s*box-sizing: border-box; \}/);
  assert.match(out, /\.template-luvia body\s*\{\s*margin: 0; \}/);
  assert.match(out, /\.template-luvia \.hero-section\s*\{\s*color: red; \}/);
  assert.match(out, /\.template-luvia \.a, \.template-luvia \.b\s*\{/);
});

test("does not split commas inside :is / :where / :not", () => {
  const out = scopeCssText(`:where(a, button, input):focus-visible { outline: 1px; }`, ".template-nexahub");
  assert.equal(
    out.includes(".template-nexahub :where(a, button, input):focus-visible"),
    true,
    out,
  );
  assert.equal(out.includes(".template-nexahub button,"), false, out);

  const parts = splitSelectorList(":is(ul, ol), .x");
  assert.deepEqual(parts, [":is(ul, ol)", " .x"]);
  assert.equal(
    prefixSelectorList(".lv-rich-text :is(ul, ol)", ".template-luvia"),
    ".template-luvia .lv-rich-text :is(ul, ol)",
  );
});

test("scopes rules inside @media but leaves keyframes and font-face global", () => {
  const css = `
@font-face { font-family: "X"; src: url(x.woff2); }
@keyframes spin { to { transform: rotate(1deg); } }
@media (min-width: 0px) {
  .product-card { color: red; }
}
`;
  const out = scopeCssText(css, ".template-nexahub");
  assert.match(out, /@font-face \{ font-family: "X";/);
  assert.match(out, /@keyframes spin \{ to \{ transform: rotate\(1deg\); \} \}/);
  assert.match(out, /@media \(min-width: 0px\) \{[\s\S]*\.template-nexahub \.product-card/);
});

test("is idempotent", () => {
  const once = scopeCssText(".a { color: red; }", ".template-luvia");
  const twice = scopeCssText(once, ".template-luvia");
  assert.equal(once, twice);
});

test("templateScopeFromId matches template paths only", () => {
  assert.equal(
    templateScopeFromId("C:/proj/apps/storefront/src/templates/luvia/v1/styles/main.scss"),
    "luvia",
  );
  assert.equal(
    templateScopeFromId("/app/src/templates/nexahub/v1/pages/index.astro?type=style"),
    "nexahub",
  );
  assert.equal(templateScopeFromId("/app/src/components/Shell.astro"), null);
});
