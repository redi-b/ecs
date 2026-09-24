export function getTemplateDemoBaseUrl(host: string | null | undefined) {
  const value = host?.trim();
  if (!value) return null;
  if (value.includes("://") && !/^https?:\/\//i.test(value)) return null;

  const withProtocol = /^https?:\/\//i.test(value)
    ? value
    : `${isLocalDemoHost(value) ? "http" : "https"}://${value}`;
  return normalizeBaseUrl(withProtocol);
}

export function getDefaultTemplateDemoUrl(demoBaseUrl: string | null, slug: string) {
  if (!demoBaseUrl) return null;
  try {
    return new URL(`/${encodeURIComponent(slug)}`, demoBaseUrl).toString();
  } catch {
    return null;
  }
}

function isLocalDemoHost(value: string) {
  const hostname = value.split("/")[0]?.split(":")[0]?.toLowerCase() ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".lvh.me");
}

function normalizeBaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
