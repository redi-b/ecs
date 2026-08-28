"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3Icon, EyeIcon, PackageCheckIcon, ShoppingBagIcon } from "lucide-react";

import { DataTable } from "@/components/app/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardDemoFixture } from "@/features/demo/dashboard-demo-fixture";
import { DemoPageHeader } from "@/features/demo/dashboard-demo-shell";
import { InsightsWorkspace } from "@/features/insights/insights-workspace";

const products = [
  ["Woven Market Tote", "Published", "ETB 1,850", "24 available"],
  ["Ceramic Coffee Set", "Published", "ETB 2,400", "8 available"],
  ["Linen Table Runner", "Draft", "ETB 1,120", "12 available"],
  ["Hand-poured Candle", "Published", "ETB 780", "31 available"],
] as const;

const orders = [
  ["#1048", "Selam Tesfaye", "ETB 2,850", "Ready for delivery"],
  ["#1047", "Hana Bekele", "ETB 1,940", "Preparing"],
  ["#1046", "Betelhem Ayele", "ETB 3,420", "Payment pending"],
  ["#1045", "Nahom Girma", "ETB 1,280", "Delivered"],
] as const;

function DemoTable({
  columns,
  rows,
}: {
  columns: readonly string[];
  rows: ReadonlyArray<readonly string[]>;
}) {
  type Row = { cells: readonly string[]; id: string };
  const data: Row[] = rows.map((cells, index) => ({ cells, id: cells[0] ?? String(index) }));
  const tableColumns: ColumnDef<Row>[] = columns.map((column, index) => ({
    id: `column-${index}`,
    header: column,
    cell: ({ row }) => {
      const value = row.original.cells[index] ?? "";
      return index === columns.length - 1 ? <Badge variant="outline">{value}</Badge> : value;
    },
    enableSorting: false,
  }));

  return (
    <DataTable
      columns={tableColumns}
      data={data}
      emptyMessage="No preview data is available."
      enableSorting={false}
      getRowId={(row) => row.id}
    />
  );
}

export function DemoProducts() {
  return (
    <>
      <DemoPageHeader
        title="Products"
        description="Organize the catalog, check availability, and keep product information ready for customers."
      />
      <DemoTable columns={["Product", "Status", "Price", "Stock"]} rows={products} />
    </>
  );
}

export function DemoOrders() {
  return (
    <>
      <DemoPageHeader
        title="Orders"
        description="See what needs attention and follow every order from confirmation to delivery."
      />
      <DemoTable columns={["Order", "Customer", "Total", "Progress"]} rows={orders} />
    </>
  );
}

export function DemoInsights() {
  return (
    <>
      <DemoPageHeader
        title="Insights"
        description="Understand sales and how shoppers move from a storefront visit to a completed order."
      />
      <InsightsWorkspace summary={dashboardDemoFixture} />
    </>
  );
}

export function DemoStorefront() {
  return (
    <>
      <DemoPageHeader
        title="Storefront"
        description="Shape how the shop looks and preview the experience before publishing changes."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Design</CardTitle>
            <CardDescription>Luvia is selected for this shop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {["#F5F0E8", "#203D33", "#C98B63"].map((color) => (
                <div
                  className="aspect-square rounded-2xl border"
                  key={color}
                  style={{ backgroundColor: color }}
                >
                  <span className="sr-only">{color}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="font-medium">Luvia</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Editorial beauty storefront with calm product storytelling.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <p className="text-sm font-medium">Storefront preview</p>
              <p className="text-xs text-muted-foreground">aster-market.ecs.et</p>
            </div>
            <Badge variant="secondary">Published</Badge>
          </div>
          <CardContent className="grid min-h-[360px] place-items-center bg-[radial-gradient(circle_at_top_left,var(--primary)_0,transparent_32%)] p-8 text-center">
            <div className="max-w-md rounded-3xl border bg-background/90 p-8 shadow-xl backdrop-blur">
              <EyeIcon className="mx-auto text-primary" />
              <p className="mt-5 text-sm uppercase tracking-[0.24em] text-muted-foreground">
                New collection
              </p>
              <h2 className="mt-2 text-3xl font-semibold">Objects for thoughtful homes.</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                A curated shop story shown with a coherent, publish-ready design.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function DemoOverviewHighlights() {
  const items = [
    { icon: ShoppingBagIcon, label: "Orders", value: "54" },
    { icon: PackageCheckIcon, label: "Products", value: "38" },
    { icon: BarChart3Icon, label: "Storefront visits", value: "1,204" },
  ];
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      {items.map(({ icon: Icon, label, value }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
