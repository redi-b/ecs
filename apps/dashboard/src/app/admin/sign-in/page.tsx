export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params?.next);
  const hasError = params?.error === "missing_email";

  return (
    <main className="dashboard-shell auth-shell">
      <section className="auth-panel panel">
        <p className="eyebrow">Merchant dashboard</p>
        <h1>Sign in</h1>
        <p className="lede">Use an email that belongs to this shop.</p>
        <form action="/admin/session" className="auth-form" method="post">
          <input name="next" type="hidden" value={nextPath} />
          <label className="field-label">
            Email
            <input
              autoComplete="email"
              className="text-input"
              defaultValue="owner@abebe.local"
              name="email"
              required
              type="email"
            />
          </label>
          {hasError ? <p className="form-error">Enter an email address.</p> : null}
          <button className="primary-button" type="submit">
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  return value;
}
