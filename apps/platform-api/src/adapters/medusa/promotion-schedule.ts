export type PromotionSchedule = "scheduled" | "current" | "expired" | "unscheduled";

/** Scheduling is independent of enabled/draft status and eligibility/budget checks. */
export function promotionSchedule(
  promotion: { startsAt: string | null; endsAt: string | null },
  now: number,
): PromotionSchedule | "unknown" {
  if (!promotion.startsAt && !promotion.endsAt) return "unscheduled";
  const start = promotion.startsAt ? Date.parse(promotion.startsAt) : -Infinity;
  const end = promotion.endsAt ? Date.parse(promotion.endsAt) : Infinity;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return "unknown";
  if (end <= now) return "expired";
  return start > now ? "scheduled" : "current";
}
