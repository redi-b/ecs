import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, `${new URL("..", import.meta.url).href}/`), "utf8");

test("NexaHub owns real home, listing, and product renderers", () => {
  const registry = read("templates/registry.ts");

  assert.match(registry, /"nexahub@1"\s*:\s*\{/);
  assert.match(registry, /ProductList:\s*NexahubV1ProductList/);
  assert.match(registry, /Product:\s*NexahubV1Product/);
  assert.doesNotMatch(
    registry.match(/"nexahub@1"[\s\S]*?\n\s*},/)?.[0] ?? "",
    /Product(List)?:\s*Fallback/,
  );
});

test("NexaHub listing preserves URL filters, pagination, and truthful states", () => {
  const source = `${read("templates/nexahub/v1/ProductList.astro")}\n${read("templates/nexahub/v1/ProductFilterBar.astro")}`;

  for (const marker of [
    'name="q"',
    'key: "collection"',
    'key: "category"',
    'name="order"',
    'rel="prev"',
    'rel="next"',
    "No products available yet",
    "No results for",
  ]) assert.ok(source.includes(marker), `listing is missing ${marker}`);
  assert.ok(source.includes("products.map((product"), "listing must use route products");
  assert.equal(/iphone|lenovo|logitech|dell/i.test(source), false, "listing must not contain mock products");
});

test("NexaHub PDP submits shared cart actions and resolves authoritative variants", () => {
  const source = read("templates/nexahub/v1/Product.astro");

  for (const marker of [
    'action="/actions/cart/add"',
    'name="variantId"',
    "variant.inStock",
    "variant.priceAmount",
    "data-option-axis",
    "data-gallery-thumb",
    "data-wishlist-toggle",
  ]) assert.ok(source.includes(marker), `PDP is missing ${marker}`);
  assert.equal(/Br\.\s*184|20% OFF|Storm Grey|16GB|512GB/i.test(source), false, "PDP must not contain reference mock commerce facts");
  assert.ok(source.includes("sanitizeProductDescription"), "PDP must sanitize merchant rich text defensively");
  assert.ok(source.includes("set:html={descriptionHtml}"), "PDP must render the sanitized rich description as markup");
});

test("NexaHub cart owns the shared mutation contract and truthful states", () => {
  const registry = read("templates/registry.ts");
  const source = read("templates/nexahub/v1/Cart.astro");
  const updateAction = read("pages/actions/cart/update.ts");
  assert.match(registry, /Cart:\s*NexahubV1Cart/);
  for (const marker of [
    'action="/actions/cart/update"',
    'action="/actions/cart/remove"',
    'action="/actions/cart/promotion"',
    "data-cart-page-status",
    "Your cart is empty",
    "Proceed to checkout",
  ]) assert.ok(source.includes(marker), `cart is missing ${marker}`);
  assert.ok(updateAction.includes("customerFacingStoreError(result.message)"), "inventory failures must not be replaced by a generic cart error");
  assert.doesNotMatch(source, /Updated\./, "visible cart state must not be followed by redundant success copy");
  assert.doesNotMatch(source, /←\s*Continue shopping/, "cart navigation must use the shared icon asset rather than a text glyph");
});

test("NexaHub checkout and confirmation own shared fulfillment and payment contracts", () => {
  const registry = read("templates/registry.ts");
  const checkout = read("templates/nexahub/v1/Checkout.astro");
  const confirmation = read("templates/nexahub/v1/OrderConfirm.astro");
  assert.match(registry, /Checkout:\s*NexahubV1Checkout/);
  assert.match(registry, /OrderConfirm:\s*NexahubV1OrderConfirm/);
  for (const marker of [
    'name="deliveryChoice"',
    'name="shippingOptionId"',
    'name="paymentMethod"',
    "/actions/checkout/chapa",
    "/actions/checkout/cod",
    "priceMismatch",
    "customerAddresses",
  ]) assert.ok(checkout.includes(marker), `checkout is missing ${marker}`);
  for (const marker of ["formatOrderReference", "data-copy-order", "hasCustomerSession", "formatMoney"]) assert.ok(confirmation.includes(marker), `confirmation is missing ${marker}`);
});

test("NexaHub owns account, wishlist, and inquiry surfaces", () => {
  const registry = read("templates/registry.ts");
  for (const slot of ["Account", "AccountOrder", "Wishlist", "Contact", "RequestItem", "About", "PaymentReturn"]) {
    assert.match(registry, new RegExp(`${slot}:\\s*NexahubV1${slot}`), `${slot} is not NexaHub-owned`);
  }
  const account = read("templates/nexahub/v1/Account.astro");
  for (const action of ["/actions/account/login", "/actions/account/register", "/actions/account/profile", "/actions/account/address", "/actions/account/logout"]) assert.ok(account.includes(action), `account is missing ${action}`);
  const contact = read("templates/nexahub/v1/Contact.astro");
  const request = read("templates/nexahub/v1/RequestItem.astro");
  assert.ok(contact.includes('name="type" value="contact"'));
  assert.ok(request.includes('name="type" value="product_request"'));
  assert.ok(contact.includes("data-inquiry-status") && request.includes("data-inquiry-status"));
});

test("NexaHub renderer map has no borrowed fallback presentation", () => {
  const registry = read("templates/registry.ts");
  const block = registry.match(/"nexahub@1"\s*:\s*\{([\s\S]*?)\n\s*},\n}/)?.[1] ?? "";
  assert.ok(block, "NexaHub registry block was not found");
  assert.doesNotMatch(block, /Fallback[A-Z]/);
  for (const slot of ["Home", "ProductList", "Product", "Cart", "Checkout", "PaymentReturn", "OrderConfirm", "Contact", "About", "RequestItem", "Wishlist", "Account", "AccountOrder", "SystemState"]) assert.match(block, new RegExp(`${slot}:\\s*NexahubV1`), `${slot} is not owned`);
  const notFound = read("pages/404.astro");
  const state = read("templates/nexahub/v1/SystemState.astro");
  assert.ok(notFound.includes("SystemState"));
  assert.ok(state.includes("noindex: true"));
});

test("every production template owns safe system states", () => {
  const registry = read("templates/registry.ts");
  const notFound = read("pages/404.astro");
  const unexpected = read("pages/500.astro");
  const offline = read("components/shell/OfflineStateEnhancer.astro");
  assert.match(registry, /SystemState:\s*LuviaV1SystemState/);
  assert.match(registry, /SystemState:\s*NexahubV1SystemState/);
  assert.ok(notFound.includes('status: 404') && notFound.includes('noindex'));
  assert.ok(unexpected.includes('status: 500') && unexpected.includes('.catch(() => null)'));
  assert.ok(offline.includes('navigator.onLine') && offline.includes('addEventListener("online"'));
});

test("NexaHub binds editable content while live rendering uses safe catalog fallbacks", () => {
  const home = read("templates/nexahub/v1/Home.astro");
  const layout = read("templates/nexahub/v1/Layout.astro");
  const button = read("templates/nexahub/v1/Button.astro");
  const preview = read("pages/preview.astro");
  const source = `${home}\n${layout}`;

  for (const path of [
    "home.hero.imageAssetId",
    "home.featuredItem.body",
    "home.categories.collectionIds",
    "home.bestSellers.productIds",
    "footer.socialLinks",
    "footer.phone",
    "footer.email",
    "footer.address",
    "footer.credit.enabled",
  ]) assert.ok(source.includes(path), `renderer is missing editor binding for ${path}`);

  assert.match(button, /editorRelatedPaths\.join\(" "\)/);
  assert.doesNotMatch(button, /JSON\.stringify\(editorRelatedPaths\)/);
  assert.match(home, /: products\)\.slice/);
  assert.match(home, /: collections\)\.slice/);
  assert.match(home, /nexahubAsset\(collection\.mediaUrl \?\? collectionProductImage\.get/);
  assert.doesNotMatch(home, /categoryImages|laptopCategory|smartphoneCategory|peripheralCategory/);
  assert.doesNotMatch(home, /Choose a catalog product to publish|Selected products will appear here/i);
  assert.ok(preview.includes("data-editor-products-path"));
});

test("NexaHub shell owns the reference dropdown, cart drawer, and wishlist controller", () => {
  const layout = read("templates/nexahub/v1/Layout.astro");
  const client = read("templates/nexahub/v1/client.ts");
  for (const marker of ["data-header-dropdown-menu", "data-cart-overlay", "data-cart-items", "data-wishlist-indicator"]) {
    assert.ok(layout.includes(marker), `shell is missing ${marker}`);
  }
  assert.ok(client.includes("initWishlistController()"));
  assert.ok(client.includes('fetch("/cart-data"'));
});

test("NexaHub exposes cart mutation failures visibly and keeps mobile product details content-sized", () => {
  const layout = read("templates/nexahub/v1/Layout.astro");
  const client = read("templates/nexahub/v1/client.ts");
  const responsive = read("templates/nexahub/v1/styles/responsive.scss");

  assert.ok(layout.includes("data-nexa-toast"), "shell needs a visible mutation feedback surface");
  assert.ok(client.includes("showToast(message"), "add-to-cart failures must reach the visible feedback surface");
  assert.match(responsive, /\.product-info\s*\{[^}]*height:\s*auto[^}]*\}/, "mobile PDP must override its desktop fixed height");
  assert.doesNotMatch(read("templates/nexahub/v1/styles/pages/product-details.scss"), /height:\s*588px/, "merchant product content must not be trapped in a fixed-height desktop card");
  assert.match(read("templates/nexahub/v1/Product.astro"), /data-description-toggle/, "long product descriptions should expose one accessible disclosure behavior across breakpoints");
  assert.match(read("templates/nexahub/v1/styles/pages/product-details.scss"), /-webkit-line-clamp:\s*5/, "collapsed product descriptions should preserve product configuration visibility");
  assert.match(read("templates/nexahub/v1/Product.astro"), /grid-template-columns:\s*48px minmax\(0, 1fr\) 48px/, "mobile quantity controls should anchor actions to both edges");
  assert.match(read("templates/nexahub/v1/styles/components/_header.scss"), /nexa-search-close/, "mobile search should animate with navigation closing");
});

test("NexaHub ports the reference listing controls and featured carousel structure", () => {
  const listing = read("templates/nexahub/v1/ProductList.astro");
  const filters = read("templates/nexahub/v1/ProductFilterBar.astro");
  const home = read("templates/nexahub/v1/Home.astro");
  const client = read("templates/nexahub/v1/client.ts");

  for (const marker of ["products-hero__card", "products-catalog__wrapper", "products-pagination__numbers", "ProductFilterBar"]) {
    assert.ok(listing.includes(marker), `listing is missing reference marker ${marker}`);
  }
  assert.doesNotMatch(listing, /<select|Apply filters|Browse products/i);
  for (const marker of ["product-filter-bar__btn", "product-filter-bar__dropdown", "data-filter-option"]) assert.ok(filters.includes(marker));
  for (const marker of ["data-featured-carousel", "hero-section__featured-meta", "hero-section__featured-dots"]) assert.ok(home.includes(marker));
  assert.ok(client.includes('from "embla-carousel"'));
});

test("NexaHub keeps reference controls visible and uses the reference carousel icons", () => {
  const button = read("templates/nexahub/v1/Button.astro");
  const home = read("templates/nexahub/v1/Home.astro");
  const headerStyles = read("templates/nexahub/v1/styles/components/_header.scss");

  assert.doesNotMatch(button, /data-text-anim="linkAnimation"/, "button labels must not be hidden without the reference animation bootstrap");
  assert.match(home, /arrow-right-icon\.svg\?raw/);
  assert.doesNotMatch(home, />←<|>→</, "category controls must use the reference SVG, not text glyphs");
  assert.match(headerStyles, /\[data-cart-count\]\s*\{[\s\S]*?position:\s*absolute/);
});

test("NexaHub never invents featured commerce and preserves reference secondary-page geometry", () => {
  const home = read("templates/nexahub/v1/Home.astro");
  const about = read("templates/nexahub/v1/About.astro");
  const indexStyles = read("templates/nexahub/v1/styles/pages/index.scss");
  const headerStyles = read("templates/nexahub/v1/styles/components/_header.scss");

  assert.doesNotMatch(home, /featuredProducts\.length \? featuredProducts : \[undefined\]/);
  assert.match(home, /template\.home\.featuredItem\.enabled && featuredProducts\.length/);
  assert.match(indexStyles, /&__dot[\s\S]*?background:\s*transparent/);
  assert.match(indexStyles, /&__featured-link-icon[\s\S]*?width:\s*8px/);
  assert.match(headerStyles, /&--dropdown[\s\S]*?svg[\s\S]*?width:\s*8px[\s\S]*?height:\s*4px/);
  assert.match(about, /about-page/);
  assert.match(about, /about-section__eyebrow/);
  assert.doesNotMatch(about, /nexa-editorial-grid|Since 2020/i);
});

test("NexaHub interaction polish is keyboard-safe, reduced-motion-safe, and announces busy commerce", () => {
  const layout = read("templates/nexahub/v1/Layout.astro");
  const client = read("templates/nexahub/v1/client.ts");
  const mainStyles = read("templates/nexahub/v1/styles/main.scss");
  const indexStyles = read("templates/nexahub/v1/styles/pages/index.scss");

  for (const marker of ["data-nexa-live", 'aria-live="polite"', 'aria-atomic="true"']) assert.ok(layout.includes(marker));
  for (const marker of ["setBusy", "aria-busy", 'event.key === "Tab"', "focusableElements", "closeFilterMenus"]) assert.ok(client.includes(marker));
  assert.match(mainStyles, /prefers-reduced-motion:\s*reduce/);
  assert.match(mainStyles, /data-busy/);
  assert.match(indexStyles, /grid-template-rows:\s*0fr/);
  assert.match(indexStyles, /grid-template-rows:\s*1fr/);
});

test("NexaHub wishlist, account, busy controls, and cart drawer stay buyer-facing and structurally stable", () => {
  const wishlist = read("templates/nexahub/v1/Wishlist.astro");
  const account = read("templates/nexahub/v1/Account.astro");
  const layout = read("templates/nexahub/v1/Layout.astro");
  const productCard = read("templates/nexahub/v1/ProductCard.astro");
  const mainStyles = read("templates/nexahub/v1/styles/main.scss");
  const cartStyles = read("templates/nexahub/v1/styles/components/_cart-drawer.scss");
  const headerStyles = read("templates/nexahub/v1/styles/components/_header.scss");

  assert.doesNotMatch(wishlist, /Saved catalog|device or customer account/i);
  assert.doesNotMatch(account, /scoped to this shop|Customer account \/ (?:active|guest)|Guest access/i);
  assert.ok(layout.includes("SaveIcon") && productCard.includes("SaveIcon"));
  assert.match(mainStyles, /button\[data-busy="true"\][\s\S]*?gap:/);
  assert.match(cartStyles, /cart-drawer-container[\s\S]*?overflow:\s*hidden/);
  assert.match(cartStyles, /&__items[\s\S]*?overflow-y:\s*auto/);
  assert.match(cartStyles, /&__summary[\s\S]*?flex-shrink:\s*0/);
  assert.match(headerStyles, /&:has\(\[data-cart-count\]\)[\s\S]*?z-index:\s*20/);
  assert.match(headerStyles, /\[data-cart-count\][\s\S]*?right:\s*-5px[\s\S]*?z-index:\s*21/);
});

test("NexaHub runtime UI keeps one save glyph, scoped styles, real carousel states, and preview structure", () => {
  const saveIcon = read("templates/nexahub/v1/SaveIcon.astro");
  const wishlist = read("templates/nexahub/v1/Wishlist.astro");
  const home = read("templates/nexahub/v1/Home.astro");
  const client = read("templates/nexahub/v1/client.ts");
  const contact = read("templates/nexahub/v1/Contact.astro");
  const preview = read("pages/preview.astro");

  assert.equal((saveIcon.match(/<svg/g) ?? []).length, 1, "save state must be layered inside one glyph");
  assert.match(wishlist, /<style is:global>/, "runtime-created wishlist cards need global selectors");
  assert.match(home, /data-cat-prev disabled/);
  assert.match(client, /track\.scrollBy/);
  assert.match(client, /previous\.disabled/);
  assert.match(contact, /<Button text="Send Message"/);
  assert.match(home, /data-editor-collection-option-featured/);
  assert.match(home, /data-editor-collection-option-standard/);
  assert.match(preview, /previewBindings/);
  assert.match(preview, /preserve-structure/);
  assert.match(preview, /data-editor-collection-option-\$\{variant\}/);
  assert.doesNotMatch(preview, /ids\.slice\(0, 4\)/);
});

test("NexaHub has a shared touch-first responsive contract for live and editor rendering", () => {
  const layout = read("templates/nexahub/v1/Layout.astro");
  const responsive = read("templates/nexahub/v1/styles/responsive.scss");
  assert.match(layout, /styles\/responsive\.scss/);
  assert.match(responsive, /@media \(max-width:\s*1023px\)/);
  assert.match(responsive, /@media \(max-width:\s*767px\)/);
  assert.match(responsive, /@media \(max-width:\s*420px\)/);
  assert.match(responsive, /min-height:\s*44px/);
  assert.match(responsive, /safe-area-inset-bottom/);
  for (const surface of ["hero-section", "catalogue-section", "products-section", "product-filter-bar", "product-main", "nexa-secondary", "nexa-commerce", "site-footer"]) {
    assert.ok(responsive.includes(surface), `responsive contract is missing ${surface}`);
  }
});

test("NexaHub navigation and cart are modal-safe while product filters stay anchored and non-modal", () => {
  const layout = read("templates/nexahub/v1/Layout.astro");
  const client = read("templates/nexahub/v1/client.ts");
  const headerStyles = read("templates/nexahub/v1/styles/components/_header.scss");
  const filterStyles = read("templates/nexahub/v1/styles/components/_product-filter-bar.scss");
  const cartStyles = read("templates/nexahub/v1/styles/components/_cart-drawer.scss");
  const responsive = read("templates/nexahub/v1/styles/responsive.scss");
  const homeStyles = read("templates/nexahub/v1/styles/pages/index.scss");

  assert.match(layout, /data-header-backdrop/);
  assert.doesNotMatch(client, /portalFilterMenu|document\.body\.append\(menu\)/);
  assert.match(client, /activeMenu\?\.closest<HTMLElement>\("\.product-filter-bar__item"\)/);
  assert.match(client, /const locked = Boolean\(header\?\.classList\.contains\("is-open"\) \|\| overlay\?\.classList\.contains\("is-visible"\)\)/);
  assert.match(client, /navigationLastFocused/);
  assert.match(client, /focusableElements\(overlay\?\.classList\.contains\("is-visible"\) \? drawer : header\)/);
  assert.match(headerStyles, /&__backdrop\.is-visible/);
  assert.doesNotMatch(filterStyles, /\.product-filter-backdrop/);
  assert.match(responsive, /\.product-filter-bar__dropdown \{ width: min\(19rem/);
  assert.match(cartStyles, /translate3d\(102%,\s*0,\s*0\)/);
  assert.match(cartStyles, /&\.is-open\s*\{\s*transform:\s*translate3d\(0,\s*0,\s*0\)/);
  assert.match(client, /requestAnimationFrame\(\(\) => window\.requestAnimationFrame/);
  assert.match(cartStyles, /cubic-bezier\(\.22,\s*\.75,\s*\.25,\s*1\)/);
  assert.doesNotMatch(homeStyles, /\.cart-drawer-(?:overlay|container)/, "the home page must not override the shared cart drawer");
});

test("NexaHub keeps its commerce shell and reference PDP structure consistent across routes", () => {
  const layout = read("templates/nexahub/v1/Layout.astro");
  const product = read("templates/nexahub/v1/Product.astro");
  const productCard = read("templates/nexahub/v1/ProductCard.astro");
  const preview = read("pages/preview.astro");

  assert.doesNotMatch(layout, /productNav && \(navigationCollections\.length/);
  assert.match(layout, /suppliedNavigationCollections === undefined/);
  assert.match(layout, /await listStoreCollections/);
  assert.match(layout, /productLinks\.map\(\(item\) => <li>/);
  assert.match(product, /similar-products__eyebrow/);
  assert.match(product, /You Might Also Like These Products/);
  assert.match(product, /object-fit: cover/);
  assert.match(productCard, /product-card__add-btn/);
  assert.match(productCard, /product-card__cart/);
  assert.match(productCard, /add-to-cart-icon/);
  assert.match(preview, /\.btn \[contenteditable\]:focus-visible/);
});

test("NexaHub editor rendering preserves the logical public route", () => {
  const layout = read("templates/nexahub/v1/Layout.astro");
  const home = read("templates/nexahub/v1/Home.astro");
  const listing = read("templates/nexahub/v1/ProductList.astro");

  assert.match(layout, /const pathname = renderPath \?\? Astro\.url\.pathname/);
  assert.match(home, /renderPath=\{editorMode \|\| demoMode \? "\/" : undefined\}/);
  assert.match(listing, /renderPath=\{editorMode \? "\/products" : undefined\}/);
});

test("NexaHub preview collection options reuse the production Astro card renderer", () => {
  const home = read("templates/nexahub/v1/Home.astro");
  const card = read("templates/nexahub/v1/CollectionCard.astro");

  assert.ok(card.includes("catalogue-section__corner-btn"));
  assert.ok(card.includes("catalogue-section__overlay-info"));
  assert.equal((home.match(/<CollectionCard/g) ?? []).length >= 3, true);
  assert.doesNotMatch(
    home.match(/data-editor-collection-option-featured[\s\S]*?<\/template>/)?.[0] ?? "",
    /catalogue-section__overlay-box/,
    "preview option templates must not carry a second handwritten card implementation",
  );
});

test("NexaHub inline preview edits never replace template-owned button or headline markup", () => {
  const home = read("templates/nexahub/v1/Home.astro");
  const button = read("templates/nexahub/v1/Button.astro");
  const preview = read("pages/preview.astro");

  assert.match(button, /class="btn__text"[^>]*data-editor-text-target/);
  assert.match(home, /hero-section__title[\s\S]*?data-editor-text-target/);
  assert.match(preview, /querySelector\('\[data-editor-text-target\]'\)/);
});

test("NexaHub derives its complete primary scale from merchant theme tokens", () => {
  const variables = read("templates/nexahub/v1/styles/_variables.scss");
  const themedSources = [
    "styles/components/_button.scss",
    "styles/components/_header.scss",
    "styles/components/_product-card.scss",
    "styles/pages/index.scss",
    "styles/pages/products.scss",
  ].map((path) => read(`templates/nexahub/v1/${path}`)).join("\n");

  assert.doesNotMatch(variables, /\$clr-primary-[^:]+:\s*#[0-9a-f]{6,8}/i);
  assert.match(variables, /\$clr-primary-500:\s*var\(--nexa-primary\)/);
  assert.match(variables, /\$clr-primary-300:\s*var\(--nexa-accent\)/);
  assert.doesNotMatch(themedSources, /#(?:3064d5|b4cffd|8eaadb|12398d)/i);
  assert.doesNotMatch(themedSources, /#(?:ddebff|f5f9ff)/i);
});

test("NexaHub page entries load the mobile contract after page-specific styles", () => {
  for (const [page, pageStyle] of [
    ["Home.astro", "./styles/pages/index.scss"],
    ["ProductList.astro", "./styles/pages/products.scss"],
    ["Product.astro", "./styles/pages/product-details.scss"],
  ] as const) {
    const source = read(`templates/nexahub/v1/${page}`);
    assert.ok(source.indexOf(pageStyle) < source.indexOf("./styles/responsive.scss"), `${page} must load responsive rules last`);
  }
});
