"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import type { DiscoveryCampaignPayload } from "@/lib/platform-api/discovery";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function DiscoveryCard({ campaigns }: { campaigns: DiscoveryCampaignPayload[] }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const titleId = useId();
  const [hidden, setHidden] = useState(false);
  const campaign = campaigns[0];
  const copy = useMemo(() => campaign?.content[locale] ?? campaign?.content.en, [campaign, locale]);

  useEffect(() => {
    if (!campaign || pathname !== dashboardRoutes.overview) return;
    void sendEvent(campaign.id, "visible", createClientId(`visible:${campaign.id}`));
  }, [campaign, pathname]);

  if (pathname !== dashboardRoutes.overview || !campaign || !copy || hidden) return null;
  const Icon = AppIcons[campaign.action.icon as keyof typeof AppIcons];
  if (!Icon) return null;
  return (
    <aside
      aria-labelledby={titleId}
      className={cn(
        "fixed right-4 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-30 w-[min(21rem,calc(100vw-2rem))]",
        "rounded-2xl border border-border bg-popover text-popover-foreground",
        "shadow-[0_8px_28px_-12px_rgb(0_0_0/0.38)] ring-1 ring-foreground/5",
        "motion-safe:animate-dashboard-base",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-[1.125rem]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{copy.eyebrow}</p>
          <h2 id={titleId} className="mt-1 text-sm font-semibold tracking-tight">
            {copy.title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.description}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="h-8 rounded-full px-3"
              onClick={() =>
                void sendEvent(campaign.id, "click", createClientId(`click:${campaign.id}`))
              }
            >
              <Link href={campaign.action.href}>{copy.action}</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 rounded-full px-3 text-muted-foreground"
              onClick={() => {
                setHidden(true);
                void sendEvent(campaign.id, "snoozed", createClientId(`snoozed:${campaign.id}`));
              }}
            >
              {t("overview.discovery.dismiss")}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

async function sendEvent(campaignId: string, event: string, idempotencyKey: string) {
  await fetch("/dashboard/discovery", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ campaignId, event, idempotencyKey }),
  }).catch(() => undefined);
}
