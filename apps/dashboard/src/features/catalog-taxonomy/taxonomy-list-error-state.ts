import type { ListErrorState } from "@/lib/list-error-state";
import { getListErrorState } from "@/lib/list-error-state";
import type { MessageKey } from "@/i18n/messages";

type TaxonomyListKind = "categories" | "collections";
type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

export function getTaxonomyListErrorState(
  kind: TaxonomyListKind,
  message: string,
  t: Translate,
): ListErrorState {
  const state = getListErrorState("products", message);
  const label =
    kind === "categories"
      ? t("taxonomy.listError.categoriesLabel")
      : t("taxonomy.listError.collectionsLabel");

  if (state.kind === "setup") {
    return {
      kind: "setup",
      title: t("taxonomy.listError.setupTitle"),
      description: t("taxonomy.listError.setupDesc", { label }),
    };
  }

  if (state.kind === "service") {
    return {
      kind: "service",
      title: t("taxonomy.listError.serviceTitle"),
      description: t("taxonomy.listError.serviceDesc", { label }),
    };
  }

  return {
    kind: "error",
    title: t("taxonomy.listError.errorTitle", { label }),
    description:
      state.description === message
        ? t("taxonomy.listError.errorDesc", { label: label.toLowerCase() })
        : state.description,
  };
}
