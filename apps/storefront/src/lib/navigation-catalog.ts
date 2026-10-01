import { listStoreCategories, listStoreCollections } from "./commerce/catalog";
import type { HostedStoreRequest, StoreCategory, StoreCollection } from "./commerce/types";
import { getPlatformApiBaseUrl, getRequestHost } from "./env";
import { STOREFRONT_LOCALE_HEADER } from "./storefront-locale";

type Catalog = { categories: StoreCategory[]; collections: StoreCollection[] };
const requests = new WeakMap<Request, Promise<Catalog>>();

/** Shell data never depends on home sections, listing filters or page defaults. */
export async function loadNavigationCatalog(
  request: Request,
  options: Partial<HostedStoreRequest> & {
    categories?: StoreCategory[];
    collections?: StoreCollection[];
    demoMode?: boolean;
    editorMode?: boolean;
  } = {},
): Promise<Catalog> {
  if (options.demoMode || options.editorMode) {
    return { categories: options.categories ?? [], collections: options.collections ?? [] };
  }
  const existing = requests.get(request);
  if (existing) return existing;
  const pending = (async () => {
    const common = {
      platformApiBaseUrl: options.platformApiBaseUrl ?? getPlatformApiBaseUrl(),
      requestHost: getRequestHost(request),
      locale:
        options.locale ??
        (request.headers.get(STOREFRONT_LOCALE_HEADER) === "am" ? "am-ET" : "en-ET"),
      ...(options.fetcher ? { fetcher: options.fetcher } : {}),
      limit: 100,
    };
    const [categories, collections] = await Promise.all([
      listStoreCategories(common).catch(() => null),
      listStoreCollections(common).catch(() => null),
    ]);
    return {
      categories: categories && "categories" in categories ? categories.categories : [],
      collections: collections && "collections" in collections ? collections.collections : [],
    };
  })();
  requests.set(request, pending);
  return pending;
}
