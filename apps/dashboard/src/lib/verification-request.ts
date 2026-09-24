export function isAllowedVerificationPost(input: {
  publicOrigin: string;
  requestOrigin: string;
  secFetchSite: string | null;
  submittedOrigin: string | null;
}) {
  if (input.secFetchSite === "cross-site") return false;
  // The browser is the strongest source here. Next can expose its internal
  // origin while the public request is reconstructed from proxy headers.
  if (input.secFetchSite === "same-origin") return true;
  if (!input.submittedOrigin) return true;

  return (
    normalizeOrigin(input.submittedOrigin) === normalizeOrigin(input.requestOrigin) ||
    normalizeOrigin(input.submittedOrigin) === normalizeOrigin(input.publicOrigin)
  );
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
