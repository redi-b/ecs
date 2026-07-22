"use client";

import { useEffect, useRef, useState } from "react";

import { AppIcons, type AppIcon } from "@/components/app/icons";
import {
  SETTINGS_SECTION_IDS,
  type SettingsSectionId,
} from "@/features/settings/settings-nav";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<SettingsSectionId, AppIcon> = {
  shop: AppIcons.settings,
  preferences: AppIcons.preferences,
  notifications: AppIcons.notifications,
  telegram: AppIcons.smartphone,
  payments: AppIcons.billing,
  fulfillment: AppIcons.orders,
  storefront: AppIcons.editor,
  account: AppIcons.user,
};

function sectionLabelKey(id: SettingsSectionId): MessageKey {
  return `settings.sections.${id}.label` as MessageKey;
}

function sectionDescriptionKey(id: SettingsSectionId): MessageKey {
  return `settings.sections.${id}.description` as MessageKey;
}

export function SettingsSectionNav({
  active,
  onSelect,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  const { t } = useI18n();
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function update() {
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(max > 4 && el.scrollLeft < max - 4);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const activeButton = el.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!activeButton) return;
    // Scroll only the chip strip — scrollIntoView can jank the whole page on mobile.
    const left =
      activeButton.offsetLeft - (el.clientWidth - activeButton.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  return (
    <nav
      aria-label={t("settings.navAria")}
      className={cn(
        // Stay pinned while settings content scrolls (under sticky AppHeader).
        // min-w-0 + max-w-full: contain chip strip so swipes scroll the strip, not the page.
        "sticky z-20 min-w-0 max-w-full self-start bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/85",
        // Mobile: horizontal chips under the 3.5rem / 4rem app header.
        "top-14 -mx-1 px-1 py-1.5 sm:top-16",
        // Desktop: sidebar column beside the form.
        "lg:top-20 lg:w-52 lg:max-w-none lg:shrink-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none",
        "lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto",
      )}
    >
      <div className="relative min-w-0 lg:static">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 flex w-8 items-center justify-start bg-linear-to-r from-background via-background/90 to-transparent pl-0.5 transition-opacity lg:hidden",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        >
          <AppIcons.arrowLeft className="size-3.5 text-muted-foreground" />
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 flex w-8 items-center justify-end bg-linear-to-l from-background via-background/90 to-transparent pr-0.5 transition-opacity lg:hidden",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        >
          <AppIcons.arrowRight className="size-3.5 text-muted-foreground" />
        </div>
        <ul
          className={cn(
            "flex min-w-0 gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-0.5 pb-1",

            "touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0 lg:touch-auto",
          )}
          ref={scrollerRef}
        >
          {SETTINGS_SECTION_IDS.map((id) => {
            const isActive = active === id;
            const Icon = SECTION_ICONS[id];
            return (
              <li className="shrink-0 lg:w-full" key={id}>
                <button
                  className={cn(
                    "flex w-full items-center gap-2 rounded-full border px-3 py-2 text-left transition-colors lg:rounded-lg lg:border-transparent",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    isActive
                      ? "border-border bg-muted text-foreground shadow-sm lg:border-transparent lg:shadow-none"
                      : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground lg:bg-transparent",
                  )}
                  data-section={id}
                  onClick={() => onSelect(id)}
                  type="button"
                >
                  <Icon className="size-3.5 shrink-0 opacity-80 lg:mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium whitespace-nowrap">
                      {t(sectionLabelKey(id))}
                    </span>
                    <span className="mt-0.5 hidden text-xs text-muted-foreground lg:block">
                      {t(sectionDescriptionKey(id))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
