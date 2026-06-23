import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMerchantProducts } from "../../../lib/merchant-products";

export default async function MerchantProductsPage() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const result = await getMerchantProducts({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost,
    limit: 20,
    offset: 0,
  });

  if (!result.ok && result.status === 401) {
    redirect("/admin/sign-in?next=/admin/products");
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
          <Link className="secondary-link" href="/admin">
            Back to dashboard
          </Link>
        </header>

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
                </tr>
              </thead>
              <tbody>
                {result.products.products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        {product.thumbnail ? (
                          <span
                            aria-hidden="true"
                            className="product-thumb product-thumb-image"
                            style={{ backgroundImage: `url(${JSON.stringify(product.thumbnail)})` }}
                          />
                        ) : (
                          <span aria-hidden="true" className="product-thumb" />
                        )}
                        <span>{product.title ?? "Untitled product"}</span>
                      </div>
                    </td>
                    <td>{product.handle ?? "Not set"}</td>
                    <td>
                      <span className="status-pill compact">
                        <span className="status-dot" />
                        {product.status ?? "unknown"}
                      </span>
                    </td>
                    <td>{formatDate(product.updatedAt)}</td>
                  </tr>
                ))}
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

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
