import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSelectedTenantId, getTenantScopedPath } from "../../../lib/dashboard-tenant-context";
import { getMerchantProducts } from "../../../lib/merchant-products";

export default async function MerchantProductsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const productStatus = getSearchParam(resolvedSearchParams, "productStatus");
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const result = await getMerchantProducts({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost,
    tenantId,
    limit: 20,
    offset: 0,
  });

  if (!result.ok && result.status === 401) {
    redirect(
      `/admin/sign-in?next=${encodeURIComponent(getTenantScopedPath("/admin/products", tenantId))}`,
    );
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Merchant dashboard</p>
            <h1>Products</h1>
            <p className="lede">
              Products are read from Medusa through the Platform API. Results are scoped to the
              current shop hostname and sales channel.
            </p>
          </div>
          <Link className="secondary-link" href={getTenantScopedPath("/admin", tenantId)}>
            Back to dashboard
          </Link>
        </header>

        {productStatus ? (
          <p className={`form-note ${isProductStatusError(productStatus) ? "error" : ""}`}>
            {getProductStatusMessage(productStatus)}
          </p>
        ) : null}

        <section className="panel product-form-panel" aria-label="Create product">
          <div>
            <h2>Create product</h2>
            <p className="lede">Add a basic product to this shop sales channel.</p>
          </div>
          <form
            action={getTenantScopedPath("/admin/products/create", tenantId)}
            className="product-form-grid"
            method="post"
          >
            <label className="field-label">
              Title
              <input className="text-input" name="title" placeholder="Coffee beans" required />
            </label>
            <label className="field-label">
              Handle
              <input className="text-input" name="handle" placeholder="coffee-beans" />
            </label>
            <label className="field-label">
              Status
              <select className="text-input" defaultValue="draft" name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="proposed">Proposed</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="field-label">
              Thumbnail URL
              <input className="text-input" name="thumbnail" placeholder="https://..." />
            </label>
            <button className="primary-button product-submit" type="submit">
              Create product
            </button>
          </form>
        </section>

        {!result.ok ? (
          <section className="panel error-panel">
            <h2>Products unavailable</h2>
            <p className="lede">
              Status {result.status}: {result.message}
            </p>
          </section>
        ) : result.products.products.length > 0 ? (
          <section className="panel table-panel" aria-label="Product list">
            <div className="section-heading compact">
              <h2>Catalog</h2>
              <p>
                {result.products.count} total, showing {result.products.products.length}
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Handle</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.products.products.map((product) => {
                  const formId = `product-form-${product.id}`;

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell editable">
                          {product.thumbnail ? (
                            <span
                              aria-hidden="true"
                              className="product-thumb product-thumb-image"
                              style={{
                                backgroundImage: `url(${JSON.stringify(product.thumbnail)})`,
                              }}
                            />
                          ) : (
                            <span aria-hidden="true" className="product-thumb" />
                          )}
                          <input
                            className="text-input table-input"
                            defaultValue={product.title ?? ""}
                            form={formId}
                            name="title"
                            placeholder="Untitled product"
                          />
                        </div>
                        <input
                          defaultValue={product.thumbnail ?? ""}
                          form={formId}
                          name="thumbnail"
                          type="hidden"
                        />
                      </td>
                      <td>
                        <input
                          className="text-input table-input"
                          defaultValue={product.handle ?? ""}
                          form={formId}
                          name="handle"
                          placeholder="Not set"
                        />
                      </td>
                      <td>
                        <select
                          className="text-input table-input"
                          defaultValue={product.status ?? "draft"}
                          form={formId}
                          name="status"
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                          <option value="proposed">Proposed</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td>{formatDate(product.updatedAt)}</td>
                      <td>
                        <form
                          action={getTenantScopedPath(
                            `/admin/products/${encodeURIComponent(product.id)}`,
                            tenantId,
                          )}
                          id={formId}
                          method="post"
                        />
                        <button
                          className="secondary-button table-action"
                          form={formId}
                          type="submit"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="panel">
            <h2>No products yet</h2>
            <p className="lede">
              The shop is connected, but Medusa returned an empty product catalog for this sales
              channel.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = searchParams?.[key];

  return Array.isArray(value) ? value[0] : value;
}

function getProductStatusMessage(status: string) {
  if (status === "product_created") {
    return "Product created.";
  }

  if (status === "product_updated") {
    return "Product updated.";
  }

  if (status === "missing_title") {
    return "Product title is required.";
  }

  if (status === "product_not_found") {
    return "Product was not found in this shop sales channel.";
  }

  if (status === "commerce_credentials_missing") {
    return "Product update failed because Medusa admin credentials are not configured.";
  }

  return "Product update failed.";
}

function isProductStatusError(status: string) {
  return status !== "product_created" && status !== "product_updated";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
