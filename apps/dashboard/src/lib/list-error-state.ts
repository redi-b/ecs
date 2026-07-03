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
      title: "Commerce credentials are not configured",
      description:
        kind === "products"
          ? "Product sync needs the Medusa Admin API token before live catalog data can be loaded."
          : "Order sync needs the Medusa Admin API token before live order data can be loaded.",
    };
  }

  if (message === "commerce_backend_unavailable") {
    return {
      kind: "service",
      title: "Commerce backend is unavailable",
      description: `The commerce backend could not be reached. Start Medusa or check the commerce service connection, then reload ${kind}.`,
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
