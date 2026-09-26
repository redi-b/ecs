import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { selectableStorefrontTemplates } from "@ecs/storefront-templates";
import { storefrontTemplateClassName } from "../templates/template-key.js";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, `${new URL("..", import.meta.url).href}/`), "utf8");

const journey = [
  {
    slot: "ProductList",
    route: "pages/products/index.astro",
    fallback: "templates/fallback/ProductListPage.astro",
    evidence: ["ProductCard", "href={prevHref}", "href={nextHref}"],
  },
  {
    slot: "Product",
    route: "pages/products/[handle].astro",
    fallback: "templates/fallback/ProductPage.astro",
    evidence: ['action="/actions/cart/add"', 'href="/cart"'],
  },
  {
    slot: "Cart",
    route: "pages/cart.astro",
    fallback: "templates/fallback/CartPage.astro",
    evidence: [
      'action="/actions/cart/update"',
      'action="/actions/cart/remove"',
      'href="/checkout"',
    ],
  },
  {
    slot: "Checkout",
    route: "pages/checkout/index.astro",
    fallback: "templates/fallback/CheckoutPage.astro",
    evidence: ['action="/actions/checkout/cod"', 'formaction="/actions/checkout/chapa"'],
  },
  {
    slot: "OrderConfirm",
    route: "pages/order/[id].astro",
    fallback: "templates/fallback/OrderConfirmPage.astro",
    evidence: ["lastOrder", 'href="/products"'],
  },
] as const;

test("every production template resolves the complete buyer journey", () => {
  const registry = read("templates/registry.ts");

  for (const template of selectableStorefrontTemplates) {
    assert.match(registry, new RegExp(`"${template.templateKey.replace("@", "\\@")}"\\s*:`));
  }

  for (const step of journey) {
    assert.match(
      registry,
      new RegExp(
        `${step.slot}:\\s*Fallback${step.slot === "OrderConfirm" ? "OrderConfirmPage" : `${step.slot}Page`}`,
      ),
    );
    assert.match(read(step.route), new RegExp(`resolveRendererSlot\\([^)]*"${step.slot}"\\)`));

    const fallback = read(step.fallback);
    for (const marker of step.evidence)
      assert.ok(fallback.includes(marker), `${step.slot} is missing ${marker}`);
  }
});

test("editor previews and template CSS share one canonical identity", () => {
  const preview = read("pages/preview.astro");
  const scoper = read("lib/css/template-css-scope.ts");
  assert.ok(preview.includes("storefrontTemplateClassName(ctx.config.storefront.templateKey)"));
  assert.equal(preview.includes("templateKey.split"), false);
  assert.ok(scoper.includes("([a-z0-9-]+)\\/v\\d+"));

  for (const template of selectableStorefrontTemplates) {
    const layout = read(
      "templates/" + template.slug + "/v" + template.version + "/layouts/Layout.astro",
    );
    assert.ok(
      layout.includes('class="' + storefrontTemplateClassName(template.templateKey) + '"'),
      template.templateKey + " layout must use its canonical scoped CSS class",
    );
  }
});

test("Afro keeps merchant configuration authoritative and demo data bounded", () => {
  const home = read("templates/afro/v1/pages/index.astro");
  const listing = read("templates/afro/v1/pages/ProductList.astro");
  const layout = read("templates/afro/v1/layouts/Layout.astro");
  const account = read("templates/afro/v1/pages/Account.astro");

  for (const marker of [
    'data-editor-products-path="home.hero.productIds"',
    'data-editor-collections-path="home.categories.collectionIds"',
    'data-editor-products-path="home.products.productIds"',
    'data-editor-collections-path="home.collections.collectionIds"',
    'data-editor-path="home.contact.infoTitle"',
    'data-editor-path="home.contact.infoBody"',
  ])
    assert.ok(home.includes(marker), "Afro home is missing " + marker);

  for (const marker of ["listing.title", "listing.body", "listing.imageAssetId"])
    assert.ok(listing.includes(marker), "Afro listing is missing " + marker);

  assert.ok(layout.includes("const navItems"));
  assert.ok(layout.includes("const quickLinks"));
  assert.equal(layout.includes("data-editor-links-path"), false);
  assert.equal(layout.includes(`data-editor-path="footer.`), false);

  assert.ok(home.includes("const showTemplatePlaceholders = demoMode || editorMode"));
  assert.equal(layout.includes('href="https://tiktok.com"'), false);
  assert.equal(layout.includes('href="https://instagram.com"'), false);
  assert.equal(layout.includes("AFRO Studio"), false);
  assert.equal(account.includes("AFRO Studio"), false);
});

test("every selectable template uses the shared analytics boundary exactly once", () => {
  for (const template of selectableStorefrontTemplates) {
    const templateDirectory = `templates/${template.slug}/v${template.version}`;
    const sourceFiles = ["Home", "ProductList", "Product", "Cart", "Checkout", "OrderConfirm"].map(
      (slot) => `${templateDirectory}/pages/${slot === "Home" ? "index" : slot}.astro`,
    );

    for (const sourceFile of sourceFiles) {
      assert.equal(
        existsSync(new URL(sourceFile, `${new URL("..", import.meta.url).href}/`)),
        true,
      );
    }

    const analyticsMounts = sourceFiles
      .map((sourceFile) => read(sourceFile))
      .filter((source) => source.includes("<StorefrontAnalytics"));
    const layout = read(`${templateDirectory}/layouts/Layout.astro`);
    if (layout.includes("<StorefrontAnalytics")) analyticsMounts.push(layout);

    assert.equal(
      analyticsMounts.length,
      1,
      `${template.templateKey} must mount the shared analytics component exactly once`,
    );
    assert.ok(
      analyticsMounts[0]?.includes("disabled={demoMode || editorMode}"),
      `${template.templateKey} must disable analytics in editor and demo modes`,
    );
  }
});

test("every selectable template has a bounded fixture-only public demo", () => {
  for (const template of selectableStorefrontTemplates) {
    const demoRoutes = [
      `pages/demo/storefront/${template.slug}.astro`,
      `pages/demo/storefront/${template.slug}/products/index.astro`,
      `pages/demo/storefront/${template.slug}/products/[handle].astro`,
      `pages/demo/storefront/${template.slug}/cart.astro`,
      `pages/demo/storefront/${template.slug}/checkout.astro`,
      `pages/demo/storefront/${template.slug}/order-confirmation.astro`,
    ];

    for (const demoRoute of demoRoutes) {
      const demo = read(demoRoute);
      assert.ok(demo.includes("demoMode"), `${demoRoute} must enable demo mode`);
      for (const forbidden of [
        "getPageContext",
        "getPublishedStorefrontConfig",
        "fetch(",
        "Astro.cookies",
      ]) {
        assert.equal(demo.includes(forbidden), false, `${demoRoute} must not use ${forbidden}`);
      }
    }
  }
});
