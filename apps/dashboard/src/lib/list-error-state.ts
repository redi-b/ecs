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
      title: "Medusa admin token is not configured",
      description:
        kind === "products"
          ? "Start Platform API with MEDUSA_ADMIN_API_TOKEN from the Medusa seed before loading live product data."
          : "Start Platform API with MEDUSA_ADMIN_API_TOKEN from the Medusa seed before loading live order data.",
    };
  }

  if (message === "commerce_credentials_invalid") {
    return {
      kind: "setup",
      title: "Medusa admin token is invalid",
      description: `Medusa rejected the configured MEDUSA_ADMIN_API_TOKEN. Re-run the Medusa seed for the active Medusa database, copy the new secret token into Platform API, restart Platform API, then reload ${kind}.`,
    };
  }

  if (message === "commerce_sales_channel_unavailable") {
    return {
      kind: "setup",
      title:
        kind === "products"
          ? "Product sales channel is not configured"
          : "Order sales channel is not configured",
      description: `This tenant is missing its Medusa sales channel mapping. Re-run provisioning or seed data, then reload ${kind}.`,
    };
  }

  if (message === "commerce_region_unavailable") {
    return {
      kind: "setup",
      title: "Commerce region is not configured",
      description: `This tenant is missing its Medusa region mapping. Re-run provisioning or seed data, then reload ${kind}.`,
    };
  }

  if (message === "commerce_resource_missing") {
    return {
      kind: "setup",
      title: "Commerce resources are out of sync",
      description:
        "The tenant has Medusa resource IDs, but Medusa did not return the expected resources. Re-run local commerce provisioning or seed data.",
    };
  }

  if (message === "commerce_backend_unavailable") {
    return {
      kind: "service",
      title: "Commerce backend is unavailable",
      description: `The commerce backend could not be reached. Start Medusa or check the commerce service connection, then reload ${kind}.`,
    };
  }

  if (message === "platform_request_failed") {
    return {
      kind: "service",
      title: "Platform API is unavailable",
      description: `The dashboard could not reach Platform API. Start the API service, then reload ${kind}.`,
    };
  }

  return {
    kind: "error",
    title: `${capitalize(kind)} could not be loaded`,
    description: message,
  };
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
