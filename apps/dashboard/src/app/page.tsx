import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isCentralDashboardHost } from "@/lib/dashboard-hosts";

export default async function DashboardHome() {
  const requestHeaders = await headers();

  if (
    isCentralDashboardHost(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"))
  ) {
    redirect("/admin");
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-main panel">
        <p className="eyebrow">Merchant console</p>
        <h1>Manage your shops</h1>
        <p className="lede">
          Sign in from your shop address or continue through the central console. For local testing,
          open <a href="http://abebe.lvh.me/admin">abebe.lvh.me/admin</a>.
        </p>
      </section>
    </main>
  );
}
