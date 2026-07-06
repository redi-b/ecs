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
        <p className="eyebrow">ECS dashboard</p>
        <h1>Operator access</h1>
        <p className="lede">
          Merchant dashboards are resolved from each shop hostname. For local testing, open{" "}
          <a href="http://abebe.lvh.me/admin">abebe.lvh.me/admin</a>.
        </p>
      </section>
    </main>
  );
}
