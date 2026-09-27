type AuthState = { authenticated?: boolean; dashboardUrl?: string; sessionProbeUrl?: string };

export async function initAuthAwareCtas() {
  const primaryCtas = document.querySelectorAll<HTMLAnchorElement>("[data-auth-cta]");
  const guestOnlyCtas = document.querySelectorAll<HTMLElement>("[data-auth-guest-only]");
  if (!primaryCtas.length && !guestOnlyCtas.length) return;

  try {
    const response = await fetch("/api/auth-state", {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return;

    const state = (await response.json()) as AuthState;
    if (!state.authenticated && state.sessionProbeUrl) {
      try {
        const probe = await fetch(state.sessionProbeUrl, {
          credentials: "include",
          signal: AbortSignal.timeout(2500),
        });
        state.authenticated = probe.ok;
      } catch {
        // Shared-cookie detection remains available when a cross-origin probe is blocked.
      }
    }
    if (!state.authenticated || !state.dashboardUrl) return;

    for (const cta of primaryCtas) {
      cta.href = state.dashboardUrl;
      const label = cta.querySelector<HTMLElement>(".btn__text");
      if (label) label.textContent = cta.dataset.authenticatedText || "Go to dashboard";
    }

    for (const cta of guestOnlyCtas) cta.hidden = true;
  } catch {
    // The landing page stays fully usable when session detection is unavailable.
  }
}
