import type { createPlatformDb } from "@ecs/db";
import * as schema from "@ecs/db";
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";

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
      permission: "notifications.manage",
      requiresSetupComplete: true,
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

export function createDiscoveryService(db: DiscoveryDb) {
  async function ensureDefaults() {
    await db
      .insert(schema.dashboardDiscoveryCampaigns)
      .values(DEFAULT_CAMPAIGNS)
      .onConflictDoNothing({ target: schema.dashboardDiscoveryCampaigns.key });
  }

  async function listEligible(input: { tenantId: string; now?: Date }) {
    const now = input.now ?? new Date();
    return db
      .select()
      .from(schema.dashboardDiscoveryCampaigns)
      .where(
        and(
          eq(schema.dashboardDiscoveryCampaigns.status, "active"),
          or(
            isNull(schema.dashboardDiscoveryCampaigns.startsAt),
            lte(schema.dashboardDiscoveryCampaigns.startsAt, now),
          ),
          or(
            isNull(schema.dashboardDiscoveryCampaigns.endsAt),
            gte(schema.dashboardDiscoveryCampaigns.endsAt, now),
          ),
        ),
      )
      .orderBy(asc(schema.dashboardDiscoveryCampaigns.priority));
  }

  async function recordEvent(input: {
    campaignId: string;
    tenantId: string;
    userId: string;
    event: string;
    metadata?: Record<string, unknown>;
  }) {
    return db
      .insert(schema.dashboardDiscoveryEvents)
      .values({ ...input, metadata: input.metadata ?? {} });
  }

  return { ensureDefaults, listEligible, recordEvent };
}
