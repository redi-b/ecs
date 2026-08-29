import type {
  AccountId,
  CapabilityCatalog,
  EntitlementDecision,
  Reservation,
  ReservationId,
} from "../domain.js";
import type { CapacityReservations, Clock } from "../ports.js";

type Scope = `${string}:${string}`;

export function createInMemoryCapacityReservations<TCatalog extends CapabilityCatalog>(input: {
  clock: Clock;
  decide(request: {
    accountId: AccountId;
    amount: number;
    capability: keyof TCatalog & string;
    reserved: number;
    used: number;
  }): Promise<EntitlementDecision>;
  identifiers: { create(): ReservationId };
}) {
  const reservations = new Map<ReservationId, Reservation & { idempotencyKey: string }>();
  const consumed = new Map<Scope, number>();
  const locks = new Map<Scope, Promise<void>>();

  async function locked<TResult>(scope: Scope, work: () => Promise<TResult>): Promise<TResult> {
    const previous = locks.get(scope) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    locks.set(scope, tail);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (locks.get(scope) === tail) locks.delete(scope);
    }
  }

  const service: CapacityReservations<TCatalog> & { getConsumed(scope: Scope): number } = {
    getConsumed: (scope) => consumed.get(scope) ?? 0,
    reserve: async (request) => {
      const scope: Scope = `${request.accountId}:${request.capability}`;
      return locked(scope, async () => {
        const existing = [...reservations.values()].find(
          (item) =>
            item.accountId === request.accountId &&
            item.capability === request.capability &&
            item.idempotencyKey === request.idempotencyKey,
        );
        if (existing) {
          const decision = await input.decide({
            ...request,
            reserved: 0,
            used: consumed.get(scope) ?? 0,
          });
          return { decision: { ...decision, allowed: true }, reservation: existing };
        }
        const now = input.clock.now();
        const activeReserved = [...reservations.values()]
          .filter(
            (item) =>
              item.accountId === request.accountId &&
              item.capability === request.capability &&
              item.status === "active" &&
              item.expiresAt > now,
          )
          .reduce((total, item) => total + item.amount, 0);
        const decision = await input.decide({
          ...request,
          reserved: activeReserved,
          used: consumed.get(scope) ?? 0,
        });
        if (!decision.allowed) return { decision, reservation: null };
        const reservation = Object.freeze({
          accountId: request.accountId,
          amount: request.amount,
          capability: request.capability,
          expiresAt: new Date(now.getTime() + request.ttlSeconds * 1_000),
          id: input.identifiers.create(),
          idempotencyKey: request.idempotencyKey,
          status: "active" as const,
        });
        reservations.set(reservation.id, reservation);
        return { decision, reservation };
      });
    },
    commit: async (id) => {
      const found = reservations.get(id);
      if (!found) throw new Error("Reservation not found.");
      const scope: Scope = `${found.accountId}:${found.capability}`;
      return locked(scope, async () => {
        const current = reservations.get(id);
        if (!current) throw new Error("Reservation not found.");
        if (current.status === "committed") return current;
        if (current.status !== "active" || current.expiresAt <= input.clock.now()) {
          throw new Error("Reservation cannot be committed.");
        }
        const committed = Object.freeze({ ...current, status: "committed" as const });
        consumed.set(scope, (consumed.get(scope) ?? 0) + current.amount);
        reservations.set(id, committed);
        return committed;
      });
    },
    release: async (id) => {
      const found = reservations.get(id);
      if (!found) throw new Error("Reservation not found.");
      const scope: Scope = `${found.accountId}:${found.capability}`;
      return locked(scope, async () => {
        const current = reservations.get(id);
        if (!current) throw new Error("Reservation not found.");
        if (current.status === "released") return current;
        if (current.status !== "active") throw new Error("Reservation cannot be released.");
        const released = Object.freeze({ ...current, status: "released" as const });
        reservations.set(id, released);
        return released;
      });
    },
  };
  return service;
}
