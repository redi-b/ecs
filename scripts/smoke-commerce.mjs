const platformApiUrl = normalizeBaseUrl(process.env.PLATFORM_API_URL ?? "http://localhost:3000");
const platformOrigin = process.env.PLATFORM_ORIGIN ?? "http://dashboard.lvh.me";
const ownerEmail = process.env.SMOKE_OWNER_EMAIL ?? "owner@abebe.local";
const ownerPassword = process.env.SMOKE_OWNER_PASSWORD ?? "password1234";
const runId = process.env.SMOKE_RUN_ID ?? Date.now().toString(36);
const tenantHandle = process.env.SMOKE_TENANT_HANDLE ?? `smoke-${runId}`;
const tenantName = process.env.SMOKE_TENANT_NAME ?? `Smoke Shop ${runId}`;
const productHandle = `smoke-product-${runId}`;
const categoryHandle = `smoke-category-${runId}`;
const collectionHandle = `smoke-collection-${runId}`;

const cookies = new Map();

try {
  await getJson("/health");
  pass("platform API is reachable");

  await postJson("/platform/auth/sign-in/email", {
    email: ownerEmail,
    password: ownerPassword,
  });
  pass(`signed in as ${ownerEmail}`);

  const me = await getJson("/platform/me");
  assert(me.user?.id, "sign in did not return a usable session");
  pass("session is valid");

  const createdTenant = await postJson("/platform/tenants", {
    handle: tenantHandle,
    name: tenantName,
  });
  const tenant = createdTenant.tenant;
  assert(tenant?.id, "tenant provisioning did not return a tenant id");
  pass(`created tenant ${tenant.handle ?? tenantHandle}`);

  await getJson(`/platform/tenants/${encodeURIComponent(tenant.id)}/products`);
  pass("listed tenant products");

  const createdCategory = await postJson(
    `/platform/tenants/${encodeURIComponent(tenant.id)}/product-categories`,
    {
      handle: categoryHandle,
      name: "Smoke Category",
    },
  );
  const category = createdCategory.category;
  assert(category?.id, "category creation did not return a category id");
  pass("created product category");

  const createdCollection = await postJson(
    `/platform/tenants/${encodeURIComponent(tenant.id)}/product-collections`,
    {
      handle: collectionHandle,
      title: "Smoke Collection",
    },
  );
  const collection = createdCollection.collection;
  assert(collection?.id, "collection creation did not return a collection id");
  pass("created product collection");

  const createdProduct = await postJson(
    `/platform/tenants/${encodeURIComponent(tenant.id)}/products`,
    {
      categoryIds: [category.id],
      collectionId: collection.id,
      currencyCode: "etb",
      description: "Created by the local commerce smoke test.",
      handle: productHandle,
      imageUrls: ["https://placehold.co/600x600/png"],
      priceAmount: 12500,
      status: "published",
      title: "Smoke Product",
    },
  );
  const product = createdProduct.product;
  assert(product?.id, "product creation did not return a product id");
  pass("created product");

  await getJson(
    `/platform/tenants/${encodeURIComponent(tenant.id)}/products/${encodeURIComponent(product.id)}`,
  );
  pass("read product detail");

  const stockResult = await getJson(
    `/platform/tenants/${encodeURIComponent(tenant.id)}/products/${encodeURIComponent(product.id)}/stock`,
  );
  assert(stockResult.stock, "stock read did not return stock data");
  pass("read product stock");

  console.log(
    JSON.stringify(
      {
        ok: true,
        productId: product.id,
        productHandle,
        tenantHandle,
        tenantId: tenant.id,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function getJson(path) {
  return requestJson("GET", path);
}

async function postJson(path, body) {
  return requestJson("POST", path, body);
}

async function requestJson(method, path, body) {
  const response = await fetch(`${platformApiUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      origin: platformOrigin,
      ...cookieHeader(),
    },
    method,
  });

  storeCookies(response.headers);

  const text = await response.text();
  const data = text ? parseJson(text, path) : {};

  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

function parseJson(text, path) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${path}, received: ${text.slice(0, 200)}`);
  }
}

function storeCookies(headers) {
  const setCookieHeaders =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie")]
        : [];

  for (const header of setCookieHeaders) {
    const [cookie] = header.split(";");
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    cookies.set(cookie.slice(0, separatorIndex), cookie.slice(separatorIndex + 1));
  }
}

function cookieHeader() {
  if (cookies.size === 0) {
    return {};
  }

  return {
    cookie: [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function pass(message) {
  console.log(`PASS ${message}`);
}
