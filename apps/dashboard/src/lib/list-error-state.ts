import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

type ListKind = "orders" | "products";

export type ListErrorState = {
  kind: "error" | "service" | "setup";
  title: string;
  description: string;
};

export function getListErrorState(kind: ListKind, message: string): ListErrorState {
  if (message === "commerce_credentials_missing") {
    return {
      kind: "setup",
      title: "Commerce connection needs attention",
      description:
        kind === "products"
          ? "Product data is not ready yet. Check the shop setup or contact support."
          : "Order data is not ready yet. Check the shop setup or contact support.",
    };
  }

  if (message === "commerce_credentials_invalid") {
    return {
      kind: "setup",
      title: "Commerce connection needs attention",
      description: `${capitalize(kind)} are temporarily unavailable. Check the shop setup or contact support.`,
    };
  }

  if (message === "commerce_sales_channel_unavailable") {
    return {
      kind: "setup",
      title: kind === "products" ? "Product channel is not ready" : "Order channel is not ready",
      description: `${capitalize(kind)} will appear after sales setup is complete.`,
    };
  }

  if (message === "commerce_region_unavailable") {
    return {
      kind: "setup",
      title: "Shop region is not ready",
      description: `${capitalize(kind)} will appear after regional checkout setup is complete.`,
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
    title: `${capitalize(kind)} could not be loaded`,
    description: mapPlatformErrorMessage(message, {
      fallback: message || `${capitalize(kind)} could not be loaded.`,
      resource: capitalize(kind),
    }),
  };
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
