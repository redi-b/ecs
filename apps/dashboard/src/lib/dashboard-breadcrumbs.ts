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

  if (productsRoute && pathname === dashboardRoutes.productsNew) {
    return [
      toBreadcrumb(productsRoute),
      {
        href: dashboardRoutes.productsNew,
        id: "products-new",
        title: "New product",
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
