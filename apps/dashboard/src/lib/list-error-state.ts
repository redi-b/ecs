import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

export type ListKind = "orders" | "products" | "customers" | "promotions";

export type ListErrorState = {
  kind: "error" | "service" | "setup";
  title: string;
  description: string;
};

export function getListErrorState(kind: ListKind, message: string): ListErrorState {
  const plural = pluralLabel(kind);
  const singular = singularLabel(kind);

  if (message === "commerce_credentials_missing") {
    return {
      kind: "setup",
      title: "Commerce connection needs attention",
      description: `${singular} data is not ready yet. Check the shop setup or contact support.`,
    };
  }

  if (message === "commerce_credentials_invalid") {
    return {
      kind: "setup",
      title: "Commerce connection needs attention",
      description: `${plural} are temporarily unavailable. Check the shop setup or contact support.`,
    };
  }

  if (message === "commerce_sales_channel_unavailable") {
    return {
      kind: "setup",
      title:
        kind === "products" || kind === "orders"
          ? `${singular} channel is not ready`
          : "Sales channel is not ready",
      description: `${plural} will appear after sales setup is complete.`,
    };
  }

  if (message === "commerce_region_unavailable") {
    return {
      kind: "setup",
      title: "Shop region is not ready",
      description: `${plural} will appear after regional checkout setup is complete.`,
    };
  }

  if (message === "commerce_resource_missing") {
    return {
      kind: "setup",
      title: "Commerce setup needs attention",
      description: "Some shop resources are not ready yet. Try again or contact support.",
    };
  }

  if (message === "commerce_backend_unavailable") {
    return {
      kind: "service",
      title: "Commerce service is temporarily unavailable",
      description: `We could not load ${kind}. Try again in a moment.`,
    };
  }

  if (message === "platform_request_failed") {
    return {
      kind: "service",
      title: "Dashboard service is temporarily unavailable",
      description: `We could not load ${kind}. Try again in a moment.`,
    };
  }

  return {
    kind: "error",
    title: `${plural} could not be loaded`,
    description: mapPlatformErrorMessage(message, {
      fallback: message || `${plural} could not be loaded.`,
      resource: plural,
    }),
  };
}

function singularLabel(kind: ListKind) {
  switch (kind) {
    case "products":
      return "Product";
    case "orders":
      return "Order";
    case "customers":
      return "Customer";
    case "promotions":
      return "Promotion";
  }
}

function pluralLabel(kind: ListKind) {
  return `${singularLabel(kind)}s`;
}
