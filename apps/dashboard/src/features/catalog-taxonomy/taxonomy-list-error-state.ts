import type { ListErrorState } from "@/lib/list-error-state";
import { getListErrorState } from "@/lib/list-error-state";

type TaxonomyListKind = "categories" | "collections";

export function getTaxonomyListErrorState(kind: TaxonomyListKind, message: string): ListErrorState {
  const state = getListErrorState("products", message);
  const label = kind === "categories" ? "Product categories" : "Product collections";
  const lowerLabel = label.toLowerCase();

  if (state.kind === "setup") {
    return {
      kind: "setup",
      title: "Catalog taxonomy setup needs attention",
      description:
        `${label} could not be loaded because catalog services are not ready. ` +
        "Contact an administrator or retry after setup is complete.",
    };
  }

  if (state.kind === "service") {
    return {
      kind: "service",
      title: "Catalog services are unavailable",
      description:
        `${label} could not be loaded right now. ` +
        "Retry after the catalog services are available.",
    };
  }

  return {
    kind: "error",
    title: `${label} could not be loaded`,
    description:
      state.description === message ? `Unable to load ${lowerLabel}.` : state.description,
  };
}
