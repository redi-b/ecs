import {
  type CatalogTranslationQueue,
  type CatalogTranslationStatus,
  catalogTranslationQueueSchema,
  type StorefrontLocale,
} from "@ecs/contracts";
import { type PlatformRequestContext, platformFetch } from "@/lib/platform-api/client";

export type StorefrontTranslationReadinessResult =
  | { ok: true; queue: CatalogTranslationQueue }
  | { ok: false; message: string; status: number };

export async function getStorefrontTranslationReadiness(
  options: PlatformRequestContext & {
    limit?: number;
    locale?: Exclude<StorefrontLocale, "en">;
    offset?: number;
    q?: string;
    resourceType?: "product" | "product_category" | "product_collection" | "shipping_option";
    status?: CatalogTranslationStatus;
  },
): Promise<StorefrontTranslationReadinessResult> {
  const response = await platformFetch(
    "/platform/merchant/storefront/translations/catalog/readiness",
    {
      ...options,
      searchParams: {
        locale: options.locale ?? "am",
        resourceType: options.resourceType ?? "product",
        limit: options.limit ?? 5,
        offset: options.offset ?? 0,
        q: options.q,
        status: options.status,
      },
    },
  ).catch(() => null);
  if (!response) return { ok: false, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => undefined);
  const parsed = catalogTranslationQueueSchema.safeParse(data);
  return response.ok && parsed.success
    ? { ok: true, queue: parsed.data }
    : {
        ok: false,
        message: typeof data?.error === "string" ? data.error : "invalid_translation_readiness",
        status: response.status,
      };
}

export async function getAllStorefrontTranslationReadiness(
  options: Omit<Parameters<typeof getStorefrontTranslationReadiness>[0], "limit" | "offset">,
): Promise<StorefrontTranslationReadinessResult> {
  const limit = 100;
  const items: CatalogTranslationQueue["items"] = [];
  let offset = 0;
  let latest: CatalogTranslationQueue | null = null;

  do {
    const result = await getStorefrontTranslationReadiness({ ...options, limit, offset });
    if (!result.ok) return result;
    latest = result.queue;
    items.push(...result.queue.items);
    offset += result.queue.items.length;
  } while (latest && offset < latest.count && latest.items.length > 0);

  if (!latest) return { ok: false, message: "invalid_translation_readiness", status: 502 };
  return {
    ok: true,
    queue: { ...latest, items, limit: Math.max(1, items.length), offset: 0 },
  };
}
