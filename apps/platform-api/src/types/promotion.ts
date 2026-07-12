export type MerchantPromotion = {
  id: string;
  code: string;
  status: "active" | "inactive" | "draft";
  method: "percentage" | "fixed";
  value: number;
  currencyCode: string | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  isAutomatic: boolean;
  promotionType: "standard" | "buyget";
  targetType: "order" | "items" | "shipping_methods";
  createdAt: string;
  updatedAt: string;
};

export type MerchantPromotionInput = {
  code: string;
  status: "active" | "inactive" | "draft";
  method: "percentage" | "fixed";
  value: number;
  currencyCode?: string | null | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
  usageLimit?: number | null | undefined;
  isAutomatic?: boolean | undefined;
  promotionType?: "standard" | "buyget" | undefined;
  targetType?: "order" | "items" | "shipping_methods" | undefined;
  allocation?: "each" | "across" | undefined;
  tenantId: string;
};

export type MerchantPromotionsResult =
  | { ok: true; promotions: MerchantPromotion[]; count: number; limit: number; offset: number }
  | { ok: false; error: string; status: number };

export type MerchantPromotionResult =
  | { ok: true; promotion: MerchantPromotion }
  | { ok: false; error: string; status: number };

export type MerchantPromotionDeleteResult =
  | { ok: true; id: string; deleted: true }
  | { ok: false; error: string; status: number };
