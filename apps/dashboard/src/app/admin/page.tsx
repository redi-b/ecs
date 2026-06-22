import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getMerchantDashboardSummary } from "../../lib/merchant-dashboard";

export default async function MerchantAdminPage() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const result = await getMerchantDashboardSummary({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost,
  });

  if (!result.ok && result.status === 401) {
    redirect("/admin/sign-in?next=/admin");
  }

  if (!result.ok) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-main panel error-panel">
          <p className="eyebrow">Merchant dashboard</p>
          <h1>Shop context unavailable</h1>
          <p className="lede">
            The dashboard could not resolve this host to a published shop. Status {result.status}:{" "}
            {result.message}
          </p>
        </section>
      </main>
    );
  }

  const { summary } = result;
  const setupItems = [
    ["Medusa store linked", summary.commerce.hasStore],
    ["Sales channel linked", summary.commerce.hasSalesChannel],
    ["Publishable key configured", summary.commerce.hasPublishableKey],
    ["Storefront published", summary.storefront.isPublished],
  ] as const;

  return (
    <main className="dashboard-shell">
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Merchant dashboard</p>
            <h1>{summary.tenant.name}</h1>
            <p className="lede">
              Operational view for this shop. Storefront and commerce checks are resolved from the
              current hostname and the active merchant session.
            </p>
          </div>
          <span className={`status-pill ${summary.tenant.status === "active" ? "" : "warning"}`}>
            <span className="status-dot" />
            {summary.tenant.status}
          </span>
        </header>

        <section className="overview-grid" aria-label="Shop overview">
          <article className="panel">
            <p className="metric-label">Shop handle</p>
            <p className="metric-value">{summary.tenant.handle}</p>
          </article>
          <article className="panel">
            <p className="metric-label">Primary domain</p>
            <p className="metric-value">{summary.domain.hostname}</p>
          </article>
          <article className="panel">
            <p className="metric-label">Template version</p>
            <p className="metric-value">{summary.storefront.templateVersion ?? "Not set"}</p>
          </article>
          <article className="panel">
            <p className="metric-label">Storefront</p>
            <p className="metric-value">
              {summary.storefront.isPublished ? "Published" : "Unpublished"}
            </p>
          </article>
        </section>

        <section className="section-grid">
          <article className="panel">
            <h2>Setup readiness</h2>
            <p className="lede">
              These checks must stay green before a merchant can sell reliably.
            </p>
            <ul className="check-list">
              {setupItems.map(([label, ready]) => (
                <li className="check-item" key={label}>
                  <span className={`check-mark ${ready ? "" : "off"}`}>{ready ? "✓" : "!"}</span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel muted">
            <h2>Resolved context</h2>
            <table className="detail-table">
              <tbody>
                <tr>
                  <th scope="row">Signed in as</th>
                  <td>
                    {summary.actor.email} ({summary.actor.role})
                  </td>
                </tr>
                <tr>
                  <th scope="row">Tenant ID</th>
                  <td>{summary.tenant.id}</td>
                </tr>
                <tr>
                  <th scope="row">Domain ID</th>
                  <td>{summary.domain.id}</td>
                </tr>
                <tr>
                  <th scope="row">Revision ID</th>
                  <td>{summary.storefront.publishedRevisionId ?? "Not published"}</td>
                </tr>
                <tr>
                  <th scope="row">Template ID</th>
                  <td>{summary.storefront.templateId ?? "Not set"}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </section>
      </div>
    </main>
  );
}
