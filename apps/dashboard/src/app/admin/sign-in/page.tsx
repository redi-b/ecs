export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params?.next);
  const errorMessage = getErrorMessage(params?.error);

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
          <label className="field-label">
            Password
            <input
              autoComplete="current-password"
              className="text-input"
              name="password"
              required
              type="password"
            />
          </label>
          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
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

function getErrorMessage(value: string | undefined) {
  switch (value) {
    case "missing_email":
      return "Enter an email address.";
    case "missing_password":
      return "Enter a password.";
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "auth_unavailable":
      return "Sign-in is temporarily unavailable.";
    default:
      return null;
  }
}
