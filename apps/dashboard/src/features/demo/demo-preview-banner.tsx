"use client";

import Link from "@/components/app/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function DemoPreviewBanner() {
  const { t } = useI18n();

  return (
    <aside className="border-b border-primary/15 bg-primary/[0.045] px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-[100rem] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <p className="text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">{t("overview.demo.previewLabel")}</strong>
          <span className="mx-1.5" aria-hidden>
            ·
          </span>
          {t("overview.demo.scopeNotice")}
        </p>
        <Button asChild className="w-fit shrink-0" size="sm" variant="outline">
          <Link data-demo-exit="true" href="/admin/sign-up">
            {t("overview.demo.createShop")}
          </Link>
        </Button>
      </div>
    </aside>
  );
}
