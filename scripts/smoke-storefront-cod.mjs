#!/usr/bin/env node
/**
 * Smoke: published storefront COD path through Platform store facade.
 *
 * Prerequisites: platform-api + Medusa running, shop published, products + shipping exist.
 *
 *   SMOKE_STORE_HOST=addistech.lvh.me pnpm smoke:storefront
 */

const platformApiUrl = (process.env.PLATFORM_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const storeHost = process.env.SMOKE_STORE_HOST ?? "addistech.lvh.me";

function headers(extra = {}) {
  return {
    "x-forwarded-host": storeHost,
    ...extra,
  };
}

async function getJson(path, init = {}) {
  const response = await fetch(`${platformApiUrl}${path}`, {
    ...init,
    headers: headers(init.headers),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = { raw: text?.slice(0, 200) };
  }
  if (!response.ok) {
    throw new Error(`${path} → ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function pass(msg) {
  console.log(`ok  ${msg}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

try {
  await getJson("/health");
  pass("platform health");

  const config = await getJson("/platform/storefront/config");
  assert(config.storefront?.templateKey, "missing templateKey");
  assert(config.commerce?.regionId, "missing regionId");
  pass(`config ${config.tenant?.handle} template=${config.storefront.templateKey}`);

  const products = await getJson("/store/products?limit=5");
  assert(Array.isArray(products.products) && products.products.length > 0, "no products");
  const product = products.products[0];
  pass(`products ${products.products.length} first=${product.handle}`);

  const detail = await getJson(`/store/products/${encodeURIComponent(product.id)}`);
  const productBody = detail.product ?? detail;
  const variant = (productBody.variants ?? [])[0];
  assert(variant?.id, "product has no variants");
  pass(`variant ${variant.id}`);

  const cartCreate = await getJson("/store/carts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ region_id: config.commerce.regionId }),
  });
  const cartId = cartCreate.cart?.id;
  assert(cartId, "cart id missing");
  pass(`cart ${cartId}`);

  await getJson(`/store/carts/${encodeURIComponent(cartId)}/line-items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ variant_id: variant.id, quantity: 1 }),
  });
  pass("line item added");

  await getJson(`/store/carts/${encodeURIComponent(cartId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "smoke-buyer@example.com",
      shipping_address: {
        first_name: "Smoke",
        phone: "0911000000",
        address_1: "Bole",
        city: "Addis Ababa",
        country_code: "et",
      },
    }),
  });
  pass("cart address set");

  const shipping = await getJson(
    `/store/shipping-options?cart_id=${encodeURIComponent(cartId)}`,
  );
  const options = shipping.shipping_options ?? shipping.shippingOptions ?? [];
  assert(options.length > 0, "no shipping options");
  const shippingOptionId = options[0].id;
  pass(`shipping option ${shippingOptionId}`);

  const payment = await getJson("/store/payment-options");
  assert(payment.payment?.cod === true, "cod should be available");
  pass(`payment-options cod=${payment.payment.cod} chapa=${payment.payment.chapa}`);

  const complete = await getJson("/store/checkout/cod", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cartId,
      shippingOptionId,
      deliveryChoice: "delivery",
      customer: {
        name: "Smoke Buyer",
        phone: "0911000000",
        email: "smoke-buyer@example.com",
      },
      address: {
        address1: "Bole Road",
        city: "Addis Ababa",
        landmark: "QA",
      },
      notes: "smoke-storefront-cod",
    }),
  });

  const orderId = complete.order?.id ?? (complete.type === "order" ? complete.order?.id : null);
  assert(orderId || complete.type === "order", `cod complete failed: ${JSON.stringify(complete).slice(0, 200)}`);
  pass(`COD order ${orderId ?? complete.order?.id ?? "created"}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        storeHost,
        productHandle: product.handle,
        cartId,
        orderId: orderId ?? complete.order?.id ?? null,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`fail ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
