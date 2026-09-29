import { z } from "zod";

export const merchantOperationChannels = [
  "storefront",
  "assisted_sale",
  "pos",
  "quote_conversion",
  "telegram",
] as const;
export const merchantOperationChannelSchema = z.enum(merchantOperationChannels);
export type MerchantOperationChannel = z.infer<typeof merchantOperationChannelSchema>;

export const commerceEventOrigins = ["medusa", "platform"] as const;
export const commerceEventOriginSchema = z.enum(commerceEventOrigins);
export type CommerceEventOrigin = z.infer<typeof commerceEventOriginSchema>;

export const pinnedMedusaCommerceEvents = {
  "inventory-item.created": "singleton",
  "inventory-item.updated": "repeatable",
  "inventory-item.deleted": "singleton",
  "inventory-level.created": "singleton",
  "inventory-level.updated": "repeatable",
  "inventory-level.deleted": "singleton",
  "reservation-item.created": "singleton",
  "reservation-item.updated": "repeatable",
  "reservation-item.deleted": "singleton",
  "order.placed": "singleton",
  "order.updated": "repeatable",
  "order.canceled": "singleton",
  "order.completed": "singleton",
  "order.return_requested": "singleton",
  "order.return_received": "singleton",
  "order.exchange_created": "singleton",
} as const;

export type CommerceEventCardinality = "singleton" | "repeatable";

function normalizeSegment(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Commerce event identity segments must be non-empty.");
  }
  return encodeURIComponent(normalized);
}

function normalizeCreatedAt(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function getMedusaEventOccurrenceId(input: {
  cardinality: CommerceEventCardinality;
  metadata?: { created_at?: unknown; eventGroupId?: unknown } | null;
  subjectId: string;
}) {
  const subjectId = input.subjectId.trim();
  if (!subjectId) throw new Error("Medusa event subject ID is required.");
  if (input.cardinality === "singleton") return subjectId;

  const createdAt = normalizeCreatedAt(input.metadata?.created_at);
  if (!createdAt) return null;
  const eventGroupId =
    typeof input.metadata?.eventGroupId === "string" && input.metadata.eventGroupId.trim()
      ? input.metadata.eventGroupId.trim()
      : "ungrouped";
  return `${createdAt}|${eventGroupId}`;
}

export function buildCommerceEventIdentity(input: {
  eventName: string;
  occurrenceId: string;
  origin: CommerceEventOrigin;
  subjectId: string;
  subjectType: string;
}) {
  return [
    "v1",
    commerceEventOriginSchema.parse(input.origin),
    normalizeSegment(input.eventName),
    normalizeSegment(input.subjectType),
    normalizeSegment(input.subjectId),
    normalizeSegment(input.occurrenceId),
  ].join(":");
}
