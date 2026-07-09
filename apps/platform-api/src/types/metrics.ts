export type DashboardMetricsResult = {
  ok: true;
  metrics: {
    attention: {
      draftProducts: number | null;
      unfulfilledOrders: number | null;
      unpaidOrders: number | null;
    };
    breakdowns: {
      fulfillmentStatus: Array<{ count: number; label: string }>;
      orderStatus: Array<{ count: number; label: string }>;
      paymentStatus: Array<{ count: number; label: string }>;
    };
    currencyCode: string;
    products: number | null;
    series: Array<{
      customers: number;
      date: string;
      orders: number;
      revenue: number;
    }>;
  };
};
