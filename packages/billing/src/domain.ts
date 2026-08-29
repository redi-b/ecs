export type AccountId = string & { readonly __accountId: unique symbol };
export type PlanId = string & { readonly __planId: unique symbol };
export type PlanVersionId = string & { readonly __planVersionId: unique symbol };
export type SubscriptionId = string & { readonly __subscriptionId: unique symbol };
export type ReservationId = string & { readonly __reservationId: unique symbol };

export type BillingInterval = "day" | "week" | "month" | "year";
export type LimitWindow = "billing_period" | "lifetime";

export type BooleanCapabilityDefinition = {
  readonly kind: "boolean";
  readonly defaultValue: false;
};

export type LimitedCapabilityDefinition = {
  readonly kind: "limit";
  readonly defaultValue: 0;
  readonly window: LimitWindow;
};

export type CapabilityDefinition = BooleanCapabilityDefinition | LimitedCapabilityDefinition;
export type CapabilityCatalog = Readonly<Record<string, CapabilityDefinition>>;

export type CapabilityValue<TDefinition extends CapabilityDefinition> =
  TDefinition extends BooleanCapabilityDefinition ? boolean : number;

export type PlanTerms<TCatalog extends CapabilityCatalog> = {
  readonly capabilities: {
    readonly [TKey in keyof TCatalog]: CapabilityValue<TCatalog[TKey]>;
  };
  readonly currency: string;
  readonly interval: BillingInterval;
  readonly priceMinor: number;
};

export type PublishedPlanVersion<TCatalog extends CapabilityCatalog> = {
  readonly fingerprint: string;
  readonly id: PlanVersionId;
  readonly planId: PlanId;
  readonly publishedAt: Date;
  readonly terms: PlanTerms<TCatalog>;
  readonly version: number;
};

export type SubscriptionStatus =
  | "pending"
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"
  | "expired";

export type Subscription = {
  readonly accountId: AccountId;
  readonly currentPeriodEnd: Date | null;
  readonly currentPeriodStart: Date | null;
  readonly id: SubscriptionId;
  readonly planVersionId: PlanVersionId;
  readonly status: SubscriptionStatus;
};

export type DecisionReason =
  | "allowed"
  | "capability_disabled"
  | "limit_available"
  | "limit_exhausted"
  | "subscription_inactive"
  | "subscription_missing"
  | "invalid_configuration";

export type EntitlementDecision = {
  readonly allowed: boolean;
  readonly capability: string;
  readonly reason: DecisionReason;
  readonly remaining: number | null;
  readonly source: "plan" | "override" | "none";
};

export type ReservationStatus = "active" | "committed" | "released" | "expired";

export type Reservation = {
  readonly accountId: AccountId;
  readonly amount: number;
  readonly capability: string;
  readonly expiresAt: Date;
  readonly id: ReservationId;
  readonly status: ReservationStatus;
};
