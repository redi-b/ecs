import type { MerchantOrder, MerchantProduct } from "@ecs/contracts";
import { AppIcons } from "@/components/app/icons";
import { ListSummary } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Button } from "@/components/ui/button";
import { dashboardDemoFixture } from "@/features/demo/dashboard-demo-fixture";
import { DemoActionButton } from "@/features/demo/demo-action-button";
import { InsightsReportNav } from "@/features/insights/insights-report-nav";
import {
  type InsightsReport,
  InsightsReportWorkspace,
} from "@/features/insights/insights-report-workspace";
import { InsightsWorkspace } from "@/features/insights/insights-workspace";
import type { OrderListFilterState } from "@/features/orders/order-domain";
import { OrdersTable } from "@/features/orders/orders-table";
import { ProductsTable } from "@/features/products/products-table";
import { getTranslations } from "@/i18n/server";

export const demoProducts: MerchantProduct[] = [
  product("woven-market-tote", "Woven Market Tote", "published", 1_850, 24),
  product("ceramic-coffee-set", "Ceramic Coffee Set", "published", 2_400, 8),
  product("linen-table-runner", "Linen Table Runner", "draft", 1_120, 12),
  product("hand-poured-candle", "Hand-poured Candle", "published", 780, 31),
];

export const demoOrders: MerchantOrder[] = [
  order("order_1048", 1048, "Selam Tesfaye", 2_850, "captured", "fulfilled"),
  order("order_1047", 1047, "Hana Bekele", 1_940, "captured", "not_fulfilled"),
  order("order_1046", 1046, "Betelhem Ayele", 3_420, "awaiting", "not_fulfilled"),
  order("order_1045", 1045, "Nahom Girma", 1_280, "captured", "fulfilled"),
];

const demoOrderFilters: OrderListFilterState = {
  created: "all",
  delivery: "all",
  method: "all",
  payment: "all",
  progress: "all",
  q: "",
};

export async function DemoProducts() {
  const t = await getTranslations();
  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <DemoActionButton icon={<AppIcons.products />} size="sm">
            {t("products.detail.createProduct")}
          </DemoActionButton>
        </>
      }
      description={t("products.description")}
      title={t("products.title")}
    >
      <ListSummary
        actions={
          <DemoActionButton icon={<AppIcons.more />} size="sm" variant="outline">
            Import / export
          </DemoActionButton>
        }
        count={demoProducts.length}
        filtered={false}
        page={1}
        pageSize={20}
      />
      <ProductsTable
        pageSize={20}
        products={demoProducts}
        readOnly
        productDetailHref={(product) => `/demo/products/${product.id}`}
        totalCount={demoProducts.length}
      />
    </PageShell>
  );
}

export async function DemoOrders() {
  const t = await getTranslations();
  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <DemoActionButton icon={<AppIcons.orders />} size="sm">
            {t("orders.create.trigger")}
          </DemoActionButton>
        </>
      }
      description={t("orders.description")}
      title={t("orders.title")}
    >
      <ListSummary count={demoOrders.length} filtered={false} page={1} pageSize={20} />
      <OrdersTable
        filters={demoOrderFilters}
        orders={demoOrders}
        pageSize={20}
        readOnly
        totalCount={demoOrders.length}
      />
    </PageShell>
  );
}

export async function DemoInsights({
  report = "overview",
}: {
  report?: "overview" | InsightsReport;
}) {
  const t = await getTranslations();
  return (
    <PageShell
      description={t(`insights.reports.descriptions.${report}`)}
      title={report === "overview" ? t("insights.title") : t(`insights.reports.${report}`)}
    >
      <InsightsReportNav demoMode />
      {report === "overview" ? (
        <InsightsWorkspace demoMode summary={dashboardDemoFixture} />
      ) : (
        <InsightsReportWorkspace report={report} summary={dashboardDemoFixture} />
      )}
    </PageShell>
  );
}

export async function DemoStorefront() {
  const t = await getTranslations();
  const demoHost = process.env.STOREFRONT_DEMO_HOST?.trim() || "demo.lvh.me";
  const demoProtocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return (
    <PageShell description={t("editor.description")} title={t("editor.title")}>
      <div className="rounded-2xl border border-border/80 bg-card p-6">
        <p className="font-medium">Luvia</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Storefront templates have their own full public demos.
        </p>
        <Button asChild className="mt-4" size="sm" variant="outline">
          <a data-demo-exit="true" href={`${demoProtocol}://${demoHost}/luvia`}>
            Open storefront demo
          </a>
        </Button>
      </div>
    </PageShell>
  );
}

function product(
  id: string,
  title: string,
  status: string,
  amount: number,
  availableQuantity: number,
): MerchantProduct {
  const timestamp = "2026-08-26T08:30:00.000Z";
  return {
    id,
    categoryIds: [],
    collectionId: null,
    createdAt: timestamp,
    description: null,
    handle: id,
    images: [],
    status,
    thumbnail: null,
    title,
    updatedAt: timestamp,
    variants: [
      {
        id: `${id}-default`,
        inventoryItemId: `${id}-inventory`,
        prices: [{ amount, currencyCode: "ETB" }],
        sku: null,
        stock: {
          availableQuantity,
          incomingQuantity: 0,
          locationId: "demo-location",
          reservedQuantity: 0,
          stockedQuantity: availableQuantity,
        },
        title: "Default",
      },
    ],
  };
}

function order(
  id: string,
  displayId: number,
  customerName: string,
  total: number,
  paymentStatus: string,
  fulfillmentStatus: string,
): MerchantOrder {
  const timestamp = "2026-08-26T08:30:00.000Z";
  return {
    id,
    createdAt: timestamp,
    currencyCode: "ETB",
    delivery: {
      choice: "delivery",
      customerName,
      customerPhone: "+251911000000",
      landmark: null,
      notes: null,
    },
    displayId,
    email: `${id}@example.com`,
    fulfillmentStatus,
    paymentMethod: "cod",
    paymentStatus,
    status: "pending",
    total,
    updatedAt: timestamp,
  };
}
