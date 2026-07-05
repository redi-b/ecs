import { appRoutes } from "@/lib/navigation";
import { dashboardRoutes } from "@/lib/routes";

export type DashboardBreadcrumb = {
  href: string;
  id: string;
  title: string;
};

export type DashboardBreadcrumbLabels = Partial<Record<string, string>>;

export function getDashboardBreadcrumbTrail(
  pathname: string,
  labels: DashboardBreadcrumbLabels = {},
): DashboardBreadcrumb[] {
  const productsRoute = appRoutes.find((route) => route.href === dashboardRoutes.products);
  const ordersRoute = appRoutes.find((route) => route.href === dashboardRoutes.orders);
  const productCategoriesRoute = productsRoute?.children?.find(
    (route) => route.href === dashboardRoutes.productCategories,
  );
  const productCollectionsRoute = productsRoute?.children?.find(
    (route) => route.href === dashboardRoutes.productCollections,
  );

  if (productsRoute && productCategoriesRoute) {
    if (pathname === dashboardRoutes.productCategories) {
      return [toBreadcrumb(productsRoute), toBreadcrumb(productCategoriesRoute)];
    }

    if (pathname === dashboardRoutes.productCategoriesNew) {
      return [
        toBreadcrumb(productsRoute),
        toBreadcrumb(productCategoriesRoute),
        {
          href: dashboardRoutes.productCategoriesNew,
          id: "product-categories-new",
          title: "New category",
        },
      ];
    }
  }

  if (productsRoute && productCollectionsRoute) {
    if (pathname === dashboardRoutes.productCollections) {
      return [toBreadcrumb(productsRoute), toBreadcrumb(productCollectionsRoute)];
    }

    if (pathname === dashboardRoutes.productCollectionsNew) {
      return [
        toBreadcrumb(productsRoute),
        toBreadcrumb(productCollectionsRoute),
        {
          href: dashboardRoutes.productCollectionsNew,
          id: "product-collections-new",
          title: "New collection",
        },
      ];
    }
  }

  if (
    productsRoute &&
    pathname.startsWith(`${dashboardRoutes.products}/`) &&
    pathname.endsWith("/edit")
  ) {
    const productHref = pathname.slice(0, -"/edit".length);

    return [
      toBreadcrumb(productsRoute),
      {
        href: productHref,
        id: "product-details",
        title: labels["product-details"] ?? "Product details",
      },
      {
        href: pathname,
        id: "product-edit",
        title: "Edit product",
      },
    ];
  }

  if (
    productsRoute &&
    pathname.startsWith(`${dashboardRoutes.products}/`) &&
    !pathname.startsWith(`${dashboardRoutes.products}/actions/`)
  ) {
    return [
      toBreadcrumb(productsRoute),
      {
        href: pathname,
        id: "product-details",
        title: labels["product-details"] ?? "Product details",
      },
    ];
  }

  if (ordersRoute && pathname.startsWith(`${dashboardRoutes.orders}/`)) {
    return [
      toBreadcrumb(ordersRoute),
      {
        href: pathname,
        id: "order-details",
        title: labels["order-details"] ?? "Order details",
      },
    ];
  }

  return (
    appRoutes
      .flatMap((item) => {
        const children = item.children ?? [];

        return [
          { route: item, trail: [item] },
          ...children.map((child) => ({ route: child, trail: [item, child] })),
        ];
      })
      .filter(({ route }) => pathname === route.href || pathname.startsWith(`${route.href}/`))
      .sort((a, b) => b.route.href.length - a.route.href.length)[0]
      ?.trail.map(toBreadcrumb) ?? []
  );
}

function toBreadcrumb(route: DashboardBreadcrumb): DashboardBreadcrumb {
  return {
    href: route.href,
    id: route.id,
    title: route.title,
  };
}
