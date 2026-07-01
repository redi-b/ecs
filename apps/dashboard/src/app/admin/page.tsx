import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSelectedTenantId, getTenantScopedPath } from "../../lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "../../lib/merchant-dashboard";
import { getStorefrontTemplates } from "../../lib/storefront-templates";

export default async function MerchantAdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const templateStatus = getSearchParam(resolvedSearchParams, "templateStatus");
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const result = await getMerchantDashboardSummary({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl,
    requestHost,
    tenantId,
  });

  if (!result.ok && result.status === 401) {
    redirect(`/admin/sign-in?next=${encodeURIComponent(getTenantScopedPath("/admin", tenantId))}`);
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
  const templateCatalog = await getStorefrontTemplates({
    platformApiBaseUrl,
  });
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

        <section className="panel action-panel" aria-label="Merchant workflows">
          <div>
            <p className="eyebrow">Workflows</p>
            <h2>Manage shop</h2>
            <p className="lede">
              Review products and orders through the internal Medusa Admin API boundary.
            </p>
          </div>
          <div className="action-links">
            <Link
              className="primary-button action-link"
              href={getTenantScopedPath("/admin/products", tenantId)}
            >
              Open products
            </Link>
            <Link className="secondary-link" href={getTenantScopedPath("/admin/orders", tenantId)}>
              Open orders
            </Link>
          </div>
        </section>

        <section className="panel template-panel" aria-label="Storefront templates">
          <div>
            <p className="eyebrow">Storefront setup</p>
            <h2>Template selection</h2>
            <p className="lede">
              Choose the approved storefront template for this shop. Selection updates the editable
              draft and does not replace the live published storefront until publishing exists.
            </p>
          </div>

          {templateStatus ? (
            <p className={`form-note ${templateStatus === "template_selected" ? "" : "error"}`}>
              {getTemplateStatusMessage(templateStatus)}
            </p>
          ) : null}

          {!templateCatalog.ok ? (
            <p className="form-note error">
              Template catalog unavailable: {templateCatalog.message}
            </p>
          ) : (
            <div className="template-grid">
              {templateCatalog.templates.map((template) => {
                const isSelected =
                  summary.storefront.templateId === template.id &&
                  summary.storefront.templateVersion === template.version.version;

                return (
                  <article className="template-card" key={template.version.templateKey}>
                    <div className="template-preview" aria-hidden="true">
                      <span>{template.slug.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="template-card-body">
                      <div>
                        <h3>{template.name}</h3>
                        <p>{template.description}</p>
                      </div>
                      <dl className="template-meta">
                        <div>
                          <dt>Version</dt>
                          <dd>{template.version.version}</dd>
                        </div>
                        <div>
                          <dt>Key</dt>
                          <dd>{template.version.templateKey}</dd>
                        </div>
                      </dl>
                      <form action="/admin/storefront/template" method="post">
                        <input name="tenantId" type="hidden" value={summary.tenant.id} />
                        <input
                          name="templateKey"
                          type="hidden"
                          value={template.version.templateKey}
                        />
                        <button className="primary-button template-action" type="submit">
                          {isSelected ? "Refresh draft" : "Select template"}
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
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

function getTemplateStatusMessage(status: string) {
  if (status === "template_selected") {
    return "Template draft updated.";
  }

  if (status === "missing_tenant") {
    return "Template selection failed because the tenant was missing.";
  }

  if (status === "missing_template") {
    return "Template selection failed because the template was missing.";
  }

  return `Template selection failed: ${status}`;
}
