/** Use the same normalized filters as the list; pagination never limits an export. */
export function listExportPath(path: string, filters: Record<string, string | undefined>) {
  const url = new URL(path, "http://dashboard.local");
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all" && key !== "page" && key !== "pageSize")
      url.searchParams.set(key, value);
  }
  url.searchParams.delete("page");
  url.searchParams.delete("pageSize");
  return `${url.pathname}${url.search}`;
}
