import type { createPlatformDb } from "@ecs/db";
import type { ManualOrderResult } from "../../adapters/medusa/manual-order-service.js";
import type {
  MerchantOrder,
  MerchantProductStockUpdateResult,
  MerchantProductsResult,
} from "../../types/index.js";
import type { TelegramOperatorService } from "./telegram-operator.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type TelegramToolsDeps = {
  db: PlatformDb;
  botToken: string;
  callbackSecret?: string;
  dashboardPublicBaseUrl?: string | null;
  operatorService: TelegramOperatorService;
  listMerchantOrders: (input: {
    limit: number;
    offset: number;
    salesChannelId: string;
  }) => Promise<
    | { ok: true; orders: MerchantOrder[]; count: number }
    | { ok: false; error: string; status: number }
  >;
  listMerchantProducts: (input: {
    limit: number;
    offset: number;
    q?: string;
    salesChannelId: string;
    stockLocationId?: string | null;
  }) => Promise<MerchantProductsResult>;
  updateMerchantProductVariantStock: (input: {
    productId: string;
    variantId: string;
    salesChannelId: string;
    stockLocationId: string;
    stockedQuantity: number;
  }) => Promise<MerchantProductStockUpdateResult>;
  createManualOrder: (input: {
    customerEmail: string;
    customerId?: string | null;
    items: Array<{ quantity: number; variantId: string }>;
    note?: string | null;
    regionId: string;
    salesChannelId: string;
    shippingAddress?: {
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      city?: string | null;
      countryCode?: string | null;
    } | null;
    shippingOptionId?: string | null;
    tenantId: string;
    userId: string;
  }) => Promise<ManualOrderResult>;
  ensureMerchantCustomer?: (input: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    tenantId: string;
  }) => Promise<
    | { ok: true; customer: { id: string; email: string } }
    | { ok: false; error: string; status: number }
  >;
};

export type TelegramOperatorContext = {
  tenantId: string;
  userId: string;
  bindingId: string;
  role: string;
  salesChannelId: string;
  stockLocationId: string | null;
  regionId: string | null;
  shippingOptionId: string | null;
  tenantName: string;
  tenantHandle: string | null;
  adminBase: string | null;
};
