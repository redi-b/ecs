import type {
  AccountId,
  CapabilityCatalog,
  EntitlementDecision,
  PublishedPlanVersion,
  Reservation,
  ReservationId,
  Subscription,
} from "./domain.js";

export type Clock = { now(): Date };
export type IdentifierFactory = { create(): string };

export interface BillingReader<TCatalog extends CapabilityCatalog> {
  decide(input: {
    accountId: AccountId;
    amount?: number;
    capability: keyof TCatalog & string;
  }): Promise<EntitlementDecision>;
  getPlanVersion(id: string): Promise<PublishedPlanVersion<TCatalog> | null>;
  getSubscription(accountId: AccountId): Promise<Subscription | null>;
}

export interface CapacityReservations<TCatalog extends CapabilityCatalog> {
  reserve(input: {
    accountId: AccountId;
    amount: number;
    capability: keyof TCatalog & string;
    idempotencyKey: string;
    ttlSeconds: number;
  }): Promise<{ decision: EntitlementDecision; reservation: Reservation | null }>;
  commit(id: ReservationId): Promise<Reservation>;
  release(id: ReservationId): Promise<Reservation>;
}

export interface BillingModule<TCatalog extends CapabilityCatalog>
  extends BillingReader<TCatalog>,
    CapacityReservations<TCatalog> {}
