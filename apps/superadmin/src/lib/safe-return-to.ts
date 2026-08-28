export function getSafeReturnTo(value: FormDataEntryValue | null, requestUrl: string) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  const requestOrigin = new URL(requestUrl).origin;
  const candidate = new URL(value, requestUrl);
  if (candidate.origin !== requestOrigin) return "/";
  return `${candidate.pathname}${candidate.search}${candidate.hash}`;
}
