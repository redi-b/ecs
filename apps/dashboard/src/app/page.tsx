import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isCentralDashboardHost } from "@/lib/dashboard-hosts";

export default async function DashboardHome() {
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (isCentralDashboardHost(requestHost)) {
    redirect("/admin");
  }

  const dashboardUrl = `https://${requestHost ?? "dashboard.lvh.me"}/admin`;

  return (
    <main className="dashboard-shell">
      <section className="dashboard-main panel">
        <p className="eyebrow">Merchant console</p>
        <h1>Manage your shops</h1>
        <p className="lede">
          Sign in from your shop address or continue through the central console. Open{" "}
          <a href={dashboardUrl}>{dashboardUrl}</a>.
        </p>
      </section>
    </main>
  );
}
