export function localizeBrowserPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const locale = document.documentElement.lang;
  const prefix = locale && location.pathname.match(new RegExp(`^/${locale}(?:/|$)`))
    ? `/${locale}`
    : "";
  if (!prefix || path === prefix || path.startsWith(`${prefix}/`)) return path;
  return path === "/" ? prefix : `${prefix}${path}`;
}
