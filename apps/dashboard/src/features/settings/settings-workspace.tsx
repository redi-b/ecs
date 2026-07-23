"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountSecurityPanel } from "@/features/settings/account-security-panel";
import { NotificationsSection } from "@/features/settings/notifications-section";
import { PaymentsSection } from "@/features/settings/payments-section";
import { SettingsSectionNav } from "@/features/settings/settings-section-nav";
import { FulfillmentSection } from "@/features/settings/settings-fulfillment-section";
import { PreferencesSection } from "@/features/settings/settings-preferences-section";
import { ShopSection } from "@/features/settings/settings-shop-section";
import { StorefrontSection } from "@/features/settings/settings-storefront-section";
import {
  formatHandleReason,
  HANDLE_PATTERN,
  type HandleAvailability,
  statusCopy,
} from "@/features/settings/settings-helpers";
import {
  parseSettingsSection,
  type SettingsSectionId,
} from "@/features/settings/settings-nav";
import { TelegramSection } from "@/features/settings/telegram-section";
import type { Delivery, SettingsWorkspaceProps } from "@/features/settings/settings-types";
import { useI18n } from "@/i18n/provider";
import {
  isLaunchAssistantHidden,
  setLaunchAssistantHidden,
} from "@/lib/launch-assistant-preferences";
import { dashboardRoutes } from "@/lib/routes";

export function SettingsWorkspace({
  delivery,
  initialTab,
  payments,
  paymentsSupportHref = null,
  settingsStatus,
  storefrontTemplates,
  summary,
  templateStatus,
}: SettingsWorkspaceProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [section, setSection] = useState<SettingsSectionId>(() =>
    parseSettingsSection(initialTab),
  );
  const [name, setName] = useState(summary.tenant.name);
  const [handle, setHandle] = useState(summary.tenant.handle);
  const [handleUnlocked, setHandleUnlocked] = useState(false);
  const [handleAvailability, setHandleAvailability] = useState<HandleAvailability>({
    status: "current",
  });
  const [deliveryState, setDeliveryState] = useState<Delivery | null>(delivery);
  const [showLaunchAssistant, setShowLaunchAssistant] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [savingFee, setSavingFee] = useState(false);
  const nameId = useId();
  const handleId = useId();
  const deliveryFeeId = useId();
  const currencyId = useId();
  const currentHost = summary.domain.hostname;
  const baseDomain = currentHost.split(".").slice(1).join(".") || "lvh.me";
  const normalizedHandle = handle.trim().toLowerCase();
  const nextHost = `${normalizedHandle || summary.tenant.handle}.${baseDomain}`;
  const handleChanged = normalizedHandle !== summary.tenant.handle;
  const nameChanged = name.trim() !== summary.tenant.name;
  const canSaveShop =
    name.trim().length >= 2 &&
    normalizedHandle.length >= 3 &&
    (!handleChanged || handleAvailability.status === "available");

  useEffect(() => {
    setShowLaunchAssistant(!isLaunchAssistantHidden(summary.tenant.id));
  }, [summary.tenant.id]);

  // Surface redirect status once as a toast, not a sticky banner.
  useEffect(() => {
    const status = settingsStatus || templateStatus;
    if (!status) return;
    toast.success(statusCopy(status, t));
    const url = new URL(window.location.href);
    url.searchParams.delete("settingsStatus");
    url.searchParams.delete("templateStatus");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [router, settingsStatus, t, templateStatus]);

  useEffect(() => {
    if (!handleUnlocked) {
      setHandleAvailability({ status: "current" });
      return;
    }

    if (!handleChanged) {
      setHandleAvailability({ status: "current" });
      return;
    }

    if (!HANDLE_PATTERN.test(normalizedHandle)) {
      setHandleAvailability({
        status: "invalid",
        message: t("settings.handle.patternHint"),
      });
      return;
    }

    const controller = new AbortController();
    setHandleAvailability({ status: "checking" });
    const timeout = window.setTimeout(async () => {
      const response = await fetch(
        `/admin/onboarding/handle?handle=${encodeURIComponent(normalizedHandle)}`,
        { signal: controller.signal },
      ).catch(() => null);

      if (!response) {
        setHandleAvailability({
          status: "unavailable",
          message: t("settings.handle.checkFailed"),
        });
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        available?: boolean;
        hostname?: string;
        reason?: string;
      };

      if (!response.ok || !data.available) {
        setHandleAvailability({
          status: "unavailable",
          message: formatHandleReason(data.reason, t),
        });
        return;
      }

      setHandleAvailability(
        data.hostname
          ? { status: "available", hostname: data.hostname }
          : { status: "available" },
      );
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [handleChanged, handleUnlocked, normalizedHandle, t]);

  function selectSection(next: SettingsSectionId) {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === "shop") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
  }

  function saveDelivery(
    nextDelivery: Delivery,
    label = t("settings.labels.fulfillmentSettings"),
  ) {
    const previous = deliveryState;
    setDeliveryState(nextDelivery);

    // Keep the raw promise so callers can await loading state.
    // toast.promise only returns a toast id, not the work promise.
    const work = (async () => {
      const response = await fetch(
        `${dashboardRoutes.settings}/actions?tenantId=${summary.tenant.id}`,
        {
          body: JSON.stringify({
            mode: "delivery",
            delivery: {
              deliveryEnabled: nextDelivery.deliveryEnabled,
              pickupEnabled: nextDelivery.pickupEnabled,
              phoneConfirmationRequired: nextDelivery.phoneConfirmationRequired,
              notesEnabled: nextDelivery.notesEnabled,
              landmarkRequired: nextDelivery.landmarkRequired,
              defaultDeliveryFee: nextDelivery.defaultDeliveryFee,
              currency: "ETB",
              zones: [],
            },
          }),
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          method: "POST",
        },
      ).catch(() => null);

      if (!response?.ok) {
        setDeliveryState(previous);
        throw new Error("save_failed");
      }
    })();

    toast.promise(work, {
      loading: t("settings.toast.savingLabel", { label: label.toLowerCase() }),
      success: t("settings.toast.savedLabel", { label }),
      error: t("settings.toast.saveFailedLabel", { label: label.toLowerCase() }),
    });

    return work;
  }

  function saveShopSettings() {
    startTransition(async () => {
      const toastId = toast.loading(
        handleChanged ? t("settings.toast.updatingAddress") : t("settings.toast.savingShop"),
      );
      const response = await fetch(
        `${dashboardRoutes.settings}/actions?tenantId=${summary.tenant.id}`,
        {
          body: JSON.stringify({
            mode: "shop",
            name,
            handle: normalizedHandle,
          }),
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          method: "POST",
        },
      ).catch(() => null);
      const body = (await response?.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string | null;
      };

      if (!response?.ok) {
        toast.error(
          body.error ? statusCopy(body.error, t) : t("settings.toast.saveShopFailed"),
          { id: toastId },
        );
        return;
      }

      if (body.redirectTo || handleChanged) {
        toast.success(t("settings.toast.addressUpdated"), { id: toastId });
        window.location.assign(
          body.redirectTo ?? `${window.location.protocol}//${nextHost}/admin/settings`,
        );
        return;
      }

      setDialogOpen(false);
      setHandleUnlocked(false);
      toast.success(t("settings.toast.shopSaved"), { id: toastId });
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* min-w-0: allow the chip strip to shrink so overflow-x scrolls inside the nav,
          not the page (flex default min-width:auto expands to fit all chips). */}
      <div className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:flex-row lg:items-start lg:gap-8">
        <SettingsSectionNav active={section} onSelect={selectSection} />

        <div className="min-w-0 flex-1" key={section}>
          {section === "shop" ? (
            <ShopSection
              canSaveShop={canSaveShop}
              currentHost={currentHost}
              handle={handle}
              handleAvailability={handleAvailability}
              handleChanged={handleChanged}
              handleId={handleId}
              handleUnlocked={handleUnlocked}
              isPending={isPending}
              name={name}
              nameChanged={nameChanged}
              nameId={nameId}
              nextHost={nextHost}
              onHandleChange={(value) => setHandle(value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              onNameChange={setName}
              onSave={() => (handleChanged ? setDialogOpen(true) : saveShopSettings())}
              onToggleHandleLock={() => {
                if (handleUnlocked) {
                  setHandle(summary.tenant.handle);
                  setHandleUnlocked(false);
                  setHandleAvailability({ status: "current" });
                  return;
                }
                setHandleUnlocked(true);
              }}
              summary={summary}
            />
          ) : null}

          {section === "preferences" ? (
            <PreferencesSection
              showLaunchAssistant={showLaunchAssistant}
              tenantId={summary.tenant.id}
              onLaunchAssistantChange={(checked) => {
                setLaunchAssistantHidden(summary.tenant.id, !checked);
                setShowLaunchAssistant(checked);
                toast.success(
                  checked ? t("settings.toast.launchEnabled") : t("settings.toast.launchHidden"),
                );
              }}
              onOpenFulfillment={() => selectSection("fulfillment")}
            />
          ) : null}

          {section === "notifications" ? (
            <NotificationsSection tenantId={summary.tenant.id} />
          ) : null}

          {section === "telegram" ? (
            <TelegramSection tenantId={summary.tenant.id} />
          ) : null}

          {section === "payments" ? (
            <PaymentsSection initialPayment={payments} supportHref={paymentsSupportHref} />
          ) : null}

          {section === "fulfillment" ? (
            <FulfillmentSection
              currencyId={currencyId}
              deliveryFeeId={deliveryFeeId}
              deliveryState={deliveryState}
              isPending={isPending}
              savingFee={savingFee}
              onDeliveryChange={setDeliveryState}
              onSaveDelivery={(next, label) => {
                void saveDelivery(next, label);
              }}
              onSaveFee={async () => {
                if (!deliveryState || savingFee) return;
                setSavingFee(true);
                try {
                  await saveDelivery(deliveryState, t("settings.labels.deliveryFee"));
                } catch {
                  // toast.promise already surfaces the error
                } finally {
                  setSavingFee(false);
                }
              }}
            />
          ) : null}

          {section === "storefront" ? (
            <StorefrontSection
              storefrontTemplates={storefrontTemplates}
              summary={summary}
            />
          ) : null}

          {section === "account" ? (
            <AccountSecurityPanel
              email={summary.actor.email}
              initialName={summary.actor.name}
            />
          ) : null}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.dialog.changeAddressTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.dialog.changeAddressDescription", {
                currentHost,
                nextHost,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button className="rounded-full" type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button
              className="rounded-full"
              disabled={isPending}
              type="button"
              onClick={saveShopSettings}
            >
              {isPending ? t("settings.dialog.updating") : t("settings.dialog.changeAddress")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
