export default function DashboardHome() {
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
