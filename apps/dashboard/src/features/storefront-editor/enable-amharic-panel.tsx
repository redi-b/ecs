"use client";

import type { StorefrontLanguageSettings } from "@ecs/contracts";
import { RiSettings4Line, RiTranslate2 } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAccess } from "@/components/app/access-context";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import Link from "@/components/app/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useI18n } from "@/i18n/provider";
import { allows, merchantPolicies } from "@/lib/access-policy";
import { dispatchStorefrontLanguagesChanged } from "@/lib/catalog-label-locale";
import { saveStorefrontLanguageSettings } from "@/lib/storefront-languages-client";

export function EnableAmharicPanel({
  initialSettings,
  tenantId,
}: {
  initialSettings: StorefrontLanguageSettings;
  tenantId: string;
}) {
  const { permissions } = useAccess();
  const { t } = useI18n();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const canEdit = allows(permissions, merchantPolicies.storefrontEdit);

  function enableAmharic() {
    if (pending || !canEdit) return;
    setConfirmOpen(false);
    startTransition(async () => {
      const nextSettings: StorefrontLanguageSettings = {
        ...initialSettings,
        enabledLocales: ["en", "am"],
      };
      const result = await saveStorefrontLanguageSettings({
        languageSettings: nextSettings,
        tenantId,
      });
      if (!result.ok) {
        toast.error(t("editor.translations.enableFailed"));
        return;
      }
      dispatchStorefrontLanguagesChanged(result.languageSettings.enabledLocales);
      toast.success(t("editor.translations.enabled"));
      router.refresh();
    });
  }

  return (
    <>
      <Empty className="min-h-72 rounded-2xl border border-dashed">
        <EmptyHeader>
          <RiTranslate2 className="size-5 text-muted-foreground" />
          <EmptyTitle>{t("editor.translations.disabledTitle")}</EmptyTitle>
          <EmptyDescription>{t("editor.translations.disabledDescription")}</EmptyDescription>
        </EmptyHeader>
        <div className="flex w-full max-w-sm flex-col-reverse gap-2 sm:w-auto sm:max-w-none sm:flex-row">
          <Button asChild className="w-full sm:w-auto" size="sm" variant="outline">
            <Link href="/dashboard/settings?section=storefront">
              <RiSettings4Line data-icon="inline-start" />
              {t("editor.translations.openSettings")}
            </Link>
          </Button>
          {canEdit ? (
            <Button
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() => setConfirmOpen(true)}
              size="sm"
              type="button"
            >
              <RiTranslate2 data-icon="inline-start" />
              {pending ? t("editor.translations.enabling") : t("editor.translations.enableAction")}
            </Button>
          ) : null}
        </div>
      </Empty>

      <ConfirmDialog
        cancelLabel={t("editor.translations.enableCancel")}
        confirmLabel={t("editor.translations.enableConfirm")}
        description={t("editor.translations.enableDescription")}
        icon="question"
        onConfirm={enableAmharic}
        onOpenChange={(open) => !pending && setConfirmOpen(open)}
        open={confirmOpen}
        title={t("editor.translations.enableTitle")}
        tone="default"
      />
    </>
  );
}
