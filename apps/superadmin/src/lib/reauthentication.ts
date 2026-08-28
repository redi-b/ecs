export function beginReauthentication(error: unknown) {
  if (error !== "reauthentication_required") return false;
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`/reauthenticate?returnTo=${encodeURIComponent(returnTo)}`);
  return true;
}
