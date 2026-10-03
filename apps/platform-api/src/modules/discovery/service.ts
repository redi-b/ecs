import type { createPlatformDb } from "@ecs/db";
import * as schema from "@ecs/db";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const DISCOVERY_EVENTS = [
  "session",
  "reserved",
  "impression",
  "visible",
  "click",
  "snoozed",
  "dismissed",
  "completed",
] as const;
type DiscoveryEvent = (typeof DISCOVERY_EVENTS)[number];

const DEFAULT_CAMPAIGNS = [
  {
    key: "telegram-intro",
    status: "active",
    priority: 30,
    content: {
      en: {
        eyebrow: "Stay informed",
        title: "Connect Telegram for shop alerts",
        description: "Get important order and shop notifications where your team already works.",
        action: "Connect Telegram",
      },
      am: {
        eyebrow: "መረጃ ይድረስዎ",
        title: "ለሱቅ ማሳወቂያዎች Telegramን ያገናኙ",
        description: "አስፈላጊ የትዕዛዝ እና የሱቅ ማሳወቂያዎችን ቡድንዎ በሚጠቀምበት ቦታ ይቀበሉ።",
        action: "Telegramን ያገናኙ",
      },
    },
    action: { href: "/dashboard/settings?section=telegram", icon: "telegram" },
    targeting: {
      permission: "notifications.read",
      minimumSessions: 1,
    },
  },
  {
    key: "custom-domain-intro",
    status: "active",
    priority: 20,
    content: {
      en: {
        eyebrow: "Your storefront",
        title: "Give your shop its own address",
        description: "Connect a custom domain while keeping your ECS address as recovery.",
        action: "Open domains",
      },
      am: {
        eyebrow: "የመደብርዎ አድራሻ",
        title: "ለሱቅዎ የራሱን አድራሻ ይስጡ",
        description: "የECS አድራሻዎን እንደ መመለሻ አማራጭ በመቆየት የራስዎን ዶሜይን ያገናኙ።",
        action: "ዶሜይኖችን ክፈት",
      },
    },
    action: { href: "/dashboard/settings?section=domains", icon: "global" },
    targeting: { permission: "domains.manage", requiresSetupComplete: true, minimumSessions: 1 },
  },
  {
    key: "quick-sale-intro",
    status: "active",
    priority: 10,
    content: {
      en: {
        eyebrow: "At the counter",
        title: "Try POS for quick sales",
        description: "Record a cash sale in seconds without leaving your catalog.",
        action: "Open POS",
      },
      am: {
        eyebrow: "በመደብሩ ላይ",
        title: "ለፈጣን ሽያጭ POSን ይሞክሩ",
        description: "ከምርት ካታሎግዎ ሳይወጡ የጥሬ ገንዘብ ሽያጭን በፍጥነት ይመዝግቡ።",
        action: "POSን ክፈት",
      },
    },
    action: { href: "/dashboard/pos", icon: "quickSale" },
    targeting: {
      permission: "orders.create",
      requiresSetupComplete: true,
      minimumSessions: 2,
      minimumAgeHours: 24,
    },
  },
];

type DiscoveryDb = ReturnType<typeof createPlatformDb>["db"];
type Targeting = {
  permission?: string;
  requiresSetupComplete?: boolean;
  minimumSessions?: number;
  minimumAgeHours?: number;
};
function targetingOf(value: unknown): Targeting {
  return value && typeof value === "object" ? (value as Targeting) : {};
}

export function createDiscoveryService(db: DiscoveryDb) {
  async function ensureDefaults() {
    await db
      .insert(schema.dashboardDiscoveryCampaigns)
      .values(DEFAULT_CAMPAIGNS)
      .onConflictDoNothing({ target: schema.dashboardDiscoveryCampaigns.key });
    // Defaults are safely refreshed only until an operator edits a campaign.
    // This lets existing local/production rows receive corrected targeting rules
    // without overwriting audited operator changes.
    for (const campaign of DEFAULT_CAMPAIGNS) {
      await db
        .update(schema.dashboardDiscoveryCampaigns)
        .set({
          action: campaign.action,
          content: campaign.content,
          targeting: campaign.targeting,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.dashboardDiscoveryCampaigns.key, campaign.key),
            isNull(schema.dashboardDiscoveryCampaigns.updatedByUserId),
          ),
        );
    }
  }

  async function listEligible(input: {
    tenantId: string;
    userId: string;
    permissions: string[];
    setupComplete: boolean;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const campaigns = await db
      .select()
      .from(schema.dashboardDiscoveryCampaigns)
      .where(
        and(
          eq(schema.dashboardDiscoveryCampaigns.status, "active"),
          orDate(schema.dashboardDiscoveryCampaigns.startsAt, now, true),
          orDate(schema.dashboardDiscoveryCampaigns.endsAt, now, false),
        ),
      )
      .orderBy(desc(schema.dashboardDiscoveryCampaigns.priority));
    const firstCampaign = campaigns[0];
    if (!firstCampaign) return [];
    const sessionDay = now.toISOString().slice(0, 10);
    await db
      .insert(schema.dashboardDiscoveryEvents)
      .values({
        campaignId: firstCampaign.id,
        tenantId: input.tenantId,
        userId: input.userId,
        event: "session",
        idempotencyKey: `session:${input.tenantId}:${input.userId}:${sessionDay}`,
        metadata: {},
      })
      .onConflictDoNothing({ target: schema.dashboardDiscoveryEvents.idempotencyKey });
    const events = await db
      .select()
      .from(schema.dashboardDiscoveryEvents)
      .where(eq(schema.dashboardDiscoveryEvents.tenantId, input.tenantId));
    const globalLastShown = events
      .filter((event) => ["reserved", "impression", "visible"].includes(event.event))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt;
    if (globalLastShown && now.getTime() - globalLastShown.getTime() < 7 * 24 * 60 * 60 * 1000)
      return [];
    const sessions = events.filter(
      (event) => event.userId === input.userId && event.event === "session",
    );
    const firstSession = sessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
      ?.createdAt;
    const selected = campaigns.find((campaign) => {
      const targeting = targetingOf(campaign.targeting);
      if (targeting.permission && !input.permissions.includes(targeting.permission)) return false;
      if (targeting.requiresSetupComplete && !input.setupComplete) return false;
      if (targeting.minimumSessions && sessions.length < targeting.minimumSessions) return false;
      if (
        targeting.minimumAgeHours &&
        (!firstSession ||
          now.getTime() - firstSession.getTime() < targeting.minimumAgeHours * 60 * 60 * 1000)
      )
        return false;
      const own = events.filter(
        (event) => event.campaignId === campaign.id && event.userId === input.userId,
      );
      if (own.some((event) => ["dismissed", "completed"].includes(event.event))) return false;
      const lastSnoozed = own
        .filter((event) => event.event === "snoozed")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt;
      if (
        lastSnoozed &&
        now.getTime() - lastSnoozed.getTime() < campaign.snoozeDays * 24 * 60 * 60 * 1000
      )
        return false;
      const lastShown = own
        .filter((event) => ["reserved", "impression", "visible"].includes(event.event))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt;
      if (
        lastShown &&
        now.getTime() - lastShown.getTime() < campaign.cooldownHours * 60 * 60 * 1000
      )
        return false;
      const impressions = own.filter((event) =>
        ["impression", "visible"].includes(event.event),
      ).length;
      return campaign.maxImpressions === null || impressions < campaign.maxImpressions;
    });
    if (!selected) return [];
    const bucket = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
    const reservation = await db
      .insert(schema.dashboardDiscoveryEvents)
      .values({
        campaignId: selected.id,
        tenantId: input.tenantId,
        userId: input.userId,
        event: "reserved",
        // One tenant/user can reserve at most one campaign in the global cadence bucket.
        idempotencyKey: `reserve:${input.tenantId}:${input.userId}:${bucket}`,
        metadata: {},
      })
      .onConflictDoNothing({ target: schema.dashboardDiscoveryEvents.idempotencyKey })
      .returning({ id: schema.dashboardDiscoveryEvents.id });
    if (!reservation.length) return [];
    return [selected];
  }

  async function recordEvent(input: {
    campaignId: string;
    tenantId: string;
    userId: string;
    event: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!DISCOVERY_EVENTS.includes(input.event as DiscoveryEvent))
      throw new Error("invalid_discovery_event");
    const campaign = await db
      .select({ id: schema.dashboardDiscoveryCampaigns.id })
      .from(schema.dashboardDiscoveryCampaigns)
      .where(eq(schema.dashboardDiscoveryCampaigns.id, input.campaignId))
      .limit(1);
    if (!campaign[0]) throw new Error("discovery_campaign_not_found");
    await db
      .insert(schema.dashboardDiscoveryEvents)
      .values({
        campaignId: input.campaignId,
        tenantId: input.tenantId,
        userId: input.userId,
        event: input.event,
        idempotencyKey: `event:${input.tenantId}:${input.idempotencyKey}`,
        metadata: input.metadata ?? {},
      })
      .onConflictDoNothing({ target: schema.dashboardDiscoveryEvents.idempotencyKey });
    return { ok: true };
  }

  async function listCampaigns() {
    return db
      .select()
      .from(schema.dashboardDiscoveryCampaigns)
      .orderBy(
        desc(schema.dashboardDiscoveryCampaigns.priority),
        schema.dashboardDiscoveryCampaigns.key,
      );
  }

  async function updateCampaign(input: {
    actorUserId: string;
    platformPrincipalId: string;
    campaignId: string;
    reason: string;
    patch: {
      status?: string;
      priority?: number;
      startsAt?: Date | null;
      endsAt?: Date | null;
      cooldownHours?: number;
      snoozeDays?: number;
      maxImpressions?: number | null;
      content?: Record<string, unknown>;
      action?: Record<string, unknown>;
      targeting?: Record<string, unknown>;
    };
  }) {
    const reason = input.reason.trim();
    if (reason.length < 10)
      return { ok: false as const, error: "discovery_invalid", status: 400 as const };
    const patch = normalizeCampaignPatch(input.patch);
    if (!patch) return { ok: false as const, error: "discovery_invalid", status: 400 as const };
    const allowedStatuses = new Set(["draft", "active", "paused", "archived"]);
    if (patch.status && !allowedStatuses.has(patch.status)) {
      return { ok: false as const, error: "discovery_invalid", status: 400 as const };
    }
    for (const value of [
      patch.priority,
      patch.cooldownHours,
      patch.snoozeDays,
      patch.maxImpressions,
    ]) {
      if (value !== undefined && value !== null && (!Number.isSafeInteger(value) || value < 0)) {
        return { ok: false as const, error: "discovery_invalid", status: 400 as const };
      }
    }
    if (
      (patch.priority !== undefined && patch.priority > 1000) ||
      (patch.cooldownHours !== undefined && patch.cooldownHours > 8760) ||
      (patch.snoozeDays !== undefined && patch.snoozeDays > 365) ||
      (patch.maxImpressions !== undefined &&
        patch.maxImpressions !== null &&
        patch.maxImpressions > 1000)
    ) {
      return { ok: false as const, error: "discovery_invalid", status: 400 as const };
    }
    if (patch.startsAt && patch.endsAt && patch.endsAt < patch.startsAt) {
      return { ok: false as const, error: "discovery_invalid", status: 400 as const };
    }
    const [updated] = await db.transaction(async (transaction) => {
      const [campaign] = await transaction
        .select({ id: schema.dashboardDiscoveryCampaigns.id })
        .from(schema.dashboardDiscoveryCampaigns)
        .where(eq(schema.dashboardDiscoveryCampaigns.id, input.campaignId))
        .limit(1);
      if (!campaign) return [];
      const [row] = await transaction
        .update(schema.dashboardDiscoveryCampaigns)
        .set({ ...patch, updatedByUserId: input.actorUserId, updatedAt: new Date() })
        .where(eq(schema.dashboardDiscoveryCampaigns.id, input.campaignId))
        .returning();
      if (row) {
        await transaction.insert(schema.auditLogs).values({
          actorUserId: input.actorUserId,
          platformPrincipalId: input.platformPrincipalId,
          action: "discovery.campaign_updated",
          targetType: "dashboard_discovery_campaign",
          targetId: row.id,
          metadata: { patch, reason },
        });
      }
      return row ? [row] : [];
    });
    return updated
      ? { ok: true as const, campaign: updated }
      : { ok: false as const, error: "discovery_not_found" as const, status: 404 as const };
  }

  return { ensureDefaults, listEligible, recordEvent, listCampaigns, updateCampaign };
}

type DiscoveryCampaignPatchInput = {
  status?: string;
  priority?: number;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  cooldownHours?: number;
  snoozeDays?: number;
  maxImpressions?: number | null;
  content?: Record<string, unknown>;
  action?: Record<string, unknown>;
  targeting?: Record<string, unknown>;
};

function normalizeCampaignPatch(patch: DiscoveryCampaignPatchInput) {
  const parseDate = (value: Date | string | null | undefined): Date | null | undefined => {
    if (value === undefined || value === null || value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };
  const startsAt = parseDate(patch.startsAt);
  const endsAt = parseDate(patch.endsAt);
  if (patch.startsAt !== undefined && startsAt === undefined) return null;
  if (patch.endsAt !== undefined && endsAt === undefined) return null;
  const normalized: {
    status?: string;
    priority?: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
    cooldownHours?: number;
    snoozeDays?: number;
    maxImpressions?: number | null;
    content?: Record<string, unknown>;
    action?: Record<string, unknown>;
    targeting?: Record<string, unknown>;
  } = {};
  if (patch.status !== undefined) normalized.status = patch.status;
  if (patch.priority !== undefined) normalized.priority = patch.priority;
  if (patch.startsAt !== undefined) normalized.startsAt = startsAt ?? null;
  if (patch.endsAt !== undefined) normalized.endsAt = endsAt ?? null;
  if (patch.cooldownHours !== undefined) normalized.cooldownHours = patch.cooldownHours;
  if (patch.snoozeDays !== undefined) normalized.snoozeDays = patch.snoozeDays;
  if (patch.maxImpressions !== undefined) normalized.maxImpressions = patch.maxImpressions;
  if (patch.content !== undefined) normalized.content = patch.content;
  if (patch.action !== undefined) normalized.action = patch.action;
  if (patch.targeting !== undefined) normalized.targeting = patch.targeting;
  return normalized;
}

function orDate(column: AnyPgColumn, now: Date, before: boolean) {
  return before ? or(isNull(column), lte(column, now)) : or(isNull(column), gte(column, now));
}
