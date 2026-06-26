import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMerchantOrders } from "../../../lib/merchant-orders";

export default async function MerchantOrdersPage() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const result = await getMerchantOrders({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost,
    limit: 20,
    offset: 0,
  });

  if (!result.ok && result.status === 401) {
    redirect("/admin/sign-in?next=/admin/orders");
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Merchant dashboard</p>
            <h1>Orders</h1>
            <p className="lede">
              Orders are read from Medusa through the Platform API and scoped to this shop sales
              channel.
            </p>
          </div>
          <Link className="secondary-link" href="/admin">
            Back to dashboard
          </Link>
        </header>

        {!result.ok ? (
          <section className="panel error-panel">
            <h2>Orders unavailable</h2>
            <p className="lede">
              Status {result.status}: {result.message}
            </p>
          </section>
        ) : result.orders.orders.length > 0 ? (
          <section className="panel table-panel" aria-label="Order list">
            <div className="section-heading compact">
              <h2>Recent orders</h2>
              <p>
                {result.orders.count} total, showing {result.orders.orders.length}
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Total</th>
                  <th scope="col">Order status</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Fulfillment</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {result.orders.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="strong-cell">
                      {order.displayId ? `#${order.displayId}` : order.id}
                    </td>
                    <td>{order.email ?? "Guest customer"}</td>
                    <td>{formatMoney(order.total, order.currencyCode)}</td>
                    <td>
                      <span className="status-pill compact">
                        <span className="status-dot" />
                        {formatStatus(order.status)}
                      </span>
                    </td>
                    <td>{formatStatus(order.paymentStatus)}</td>
                    <td>{formatStatus(order.fulfillmentStatus)}</td>
                    <td>{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="panel">
            <h2>No orders yet</h2>
            <p className="lede">This shop has no orders in its sales channel yet.</p>
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

function formatMoney(value: number | null, currencyCode: string | null) {
  if (value === null) {
    return "Not available";
  }

  return new Intl.NumberFormat("en", {
    currency: currencyCode?.toUpperCase() ?? "ETB",
    style: "currency",
  }).format(value);
}

function formatStatus(value: string | null) {
  return value?.replaceAll("_", " ") ?? "unknown";
}
