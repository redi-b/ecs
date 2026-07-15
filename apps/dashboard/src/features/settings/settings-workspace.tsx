"use client";

import type {
  MerchantDashboardAccess,
  StorefrontTemplateCatalogItem,
} from "@ecs/contracts";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppIcons, type AppIcon } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountSecurityPanel } from "@/features/settings/account-security-panel";
import { NotificationsSection } from "@/features/settings/notifications-section";
import { getSelectedTemplateName, statusCopy } from "@/features/settings/settings-helpers";
import {
  parseSettingsSection,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/features/settings/settings-nav";
import {
  SettingsLinkRow,
  SettingsRow,
  StorefrontTemplateOption,
} from "@/features/settings/settings-sections";
import type { Delivery, SettingsWorkspaceProps } from "@/features/settings/settings-types";
import { deliveryLabels } from "@/features/settings/settings-types";
import {
  isLaunchAssistantHidden,
  setLaunchAssistantHidden,
} from "@/lib/launch-assistant-preferences";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<SettingsSectionId, AppIcon> = {
  shop: AppIcons.settings,
  preferences: AppIcons.preferences,
  notifications: AppIcons.notifications,
  fulfillment: AppIcons.orders,
  storefront: AppIcons.editor,
  account: AppIcons.user,
};

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

type HandleAvailability =
  | { status: "idle" }
  | { status: "current" }
  | { status: "checking" }
  | { status: "available"; hostname?: string }
  | { status: "unavailable"; message: string }
  | { status: "invalid"; message: string };

export function SettingsWorkspace({
  delivery,
  initialTab,
  settingsStatus,
  storefrontTemplates,
  summary,
  templateStatus,
}: SettingsWorkspaceProps) {
  const router = useRouter();
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
    toast.success(statusCopy(status));
    const url = new URL(window.location.href);
    url.searchParams.delete("settingsStatus");
    url.searchParams.delete("templateStatus");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [router, settingsStatus, templateStatus]);

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
        message: "Use 3–63 characters: lowercase letters, numbers, and hyphens.",
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
          message: "Could not check availability. Try again.",
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
          message: formatHandleReason(data.reason),
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
  }, [handleChanged, handleUnlocked, normalizedHandle]);

  function selectSection(next: SettingsSectionId) {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === "shop") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
  }

  function saveDelivery(nextDelivery: Delivery, label = "Fulfillment settings") {
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
      loading: `Saving ${label.toLowerCase()}…`,
      success: `${label} saved`,
      error: `Could not save ${label.toLowerCase()}`,
    });

    return work;
  }

  function saveShopSettings() {
    startTransition(async () => {
      const toastId = toast.loading(handleChanged ? "Updating shop address…" : "Saving shop…");
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
        toast.error(body.error ? statusCopy(body.error) : "Could not save shop settings.", {
          id: toastId,
        });
        return;
      }

      if (body.redirectTo || handleChanged) {
        toast.success("Shop address updated. Redirecting…", { id: toastId });
        window.location.assign(
          body.redirectTo ?? `${window.location.protocol}//${nextHost}/admin/settings`,
        );
        return;
      }

      setDialogOpen(false);
      setHandleUnlocked(false);
      toast.success("Shop settings saved.", { id: toastId });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <SettingsSectionNav active={section} onSelect={selectSection} />

        <div className="min-w-0 flex-1">
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
                toast.success(checked ? "Launch assistant enabled" : "Launch assistant hidden");
              }}
              onOpenFulfillment={() => selectSection("fulfillment")}
            />
          ) : null}

          {section === "notifications" ? (
            <NotificationsSection tenantId={summary.tenant.id} />
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
                  await saveDelivery(deliveryState, "Delivery fee");
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
            <DialogTitle>Change shop address?</DialogTitle>
            <DialogDescription>
              {currentHost} will stop working for this shop. You will be redirected to {nextHost}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button className="rounded-full" type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="rounded-full"
              disabled={isPending}
              type="button"
              onClick={saveShopSettings}
            >
              {isPending ? "Updating…" : "Change address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsSectionNav({
  active,
  onSelect,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
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
    activeButton?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav
      aria-label="Settings sections"
      className="relative lg:sticky lg:top-20 lg:w-52 lg:shrink-0"
    >
      <div className="relative lg:static">
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
          className="flex gap-1.5 overflow-x-auto scroll-smooth px-0.5 pb-1 [scrollbar-width:none] lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
          ref={scrollerRef}
        >
          {SETTINGS_SECTIONS.map((item) => {
            const isActive = active === item.id;
            const Icon = SECTION_ICONS[item.id];
            return (
              <li className="shrink-0 lg:w-full" key={item.id}>
                <button
                  className={cn(
                    "flex w-full items-center gap-2 rounded-full border px-3 py-2 text-left transition-colors lg:rounded-lg lg:border-transparent",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    isActive
                      ? "border-border bg-muted text-foreground shadow-sm lg:border-transparent lg:shadow-none"
                      : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground lg:bg-transparent",
                  )}
                  data-section={item.id}
                  onClick={() => onSelect(item.id)}
                  type="button"
                >
                  <Icon className="size-3.5 shrink-0 opacity-80 lg:mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                    <span className="mt-0.5 hidden text-xs text-muted-foreground lg:block">
                      {item.description}
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

function ShopSection({
  canSaveShop,
  currentHost,
  handle,
  handleAvailability,
  handleChanged,
  handleId,
  handleUnlocked,
  isPending,
  name,
  nameChanged,
  nameId,
  nextHost,
  onHandleChange,
  onNameChange,
  onSave,
  onToggleHandleLock,
  summary,
}: {
  canSaveShop: boolean;
  currentHost: string;
  handle: string;
  handleAvailability: HandleAvailability;
  handleChanged: boolean;
  handleId: string;
  handleUnlocked: boolean;
  isPending: boolean;
  name: string;
  nameChanged: boolean;
  nameId: string;
  nextHost: string;
  onHandleChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onToggleHandleLock: () => void;
  summary: MerchantDashboardAccess;
}) {
  const dirty = nameChanged || handleChanged;

  return (
    <div className="flex flex-col gap-6">
      <SectionIntro
        description="Public identity for customers and the hostname used by staff."
        title="Shop"
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Shop details</CardTitle>
            <CardDescription>Name and subdomain for this merchant shop.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={nameId}>Shop name</FieldLabel>
                <Input id={nameId} onChange={(e) => onNameChange(e.target.value)} value={name} />
              </Field>
              <Field>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor={handleId}>Shop handle</FieldLabel>
                  {!handleUnlocked ? (
                    <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Locked
                    </span>
                  ) : null}
                </div>
                <InputGroup>
                  <InputGroupInput
                    aria-invalid={
                      handleAvailability.status === "unavailable" ||
                      handleAvailability.status === "invalid"
                        ? true
                        : undefined
                    }
                    disabled={!handleUnlocked}
                    id={handleId}
                    onChange={(e) => onHandleChange(e.target.value)}
                    spellCheck={false}
                    value={handle}
                  />
                  <InputGroupAddon align="inline-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          aria-label={handleUnlocked ? "Lock shop handle" : "Unlock shop handle"}
                          onClick={onToggleHandleLock}
                          size="icon-xs"
                          type="button"
                        >
                          {handleUnlocked ? <AppIcons.lockUnlock /> : <AppIcons.lock />}
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>
                        {handleUnlocked ? "Lock handle" : "Unlock to change handle"}
                      </TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-xs">{nextHost}</span>
                  <HandleStatus availability={handleAvailability} />
                </FieldDescription>
              </Field>
            </FieldGroup>
            {handleChanged ? (
              <Alert>
                <AlertTitle>Changing the shop address</AlertTitle>
                <AlertDescription>
                  The current subdomain stops resolving and this dashboard moves to the new address
                  after you save.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end">
              <Button
                className="rounded-full"
                disabled={!canSaveShop || !dirty || isPending}
                onClick={onSave}
                size="sm"
                type="button"
              >
                {isPending ? "Saving…" : "Save shop"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hostname</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <SettingsLinkRow
                label={handleChanged ? "Current" : "Primary"}
                value={currentHost}
              />
              {handleChanged ? <SettingsLinkRow label="After save" value={nextHost} /> : null}
              <SettingsRow label="Status" value={summary.tenant.status} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Related</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild className="justify-start rounded-full" size="sm" variant="outline">
                <a href={dashboardRoutes.billing}>Billing & plan</a>
              </Button>
              <Button asChild className="justify-start rounded-full" size="sm" variant="outline">
                <a href={dashboardRoutes.editor}>Storefront editor</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HandleStatus({ availability }: { availability: HandleAvailability }) {
  if (availability.status === "checking") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <AppIcons.loader className="size-3 animate-spin" />
        Checking…
      </span>
    );
  }
  if (availability.status === "available") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <AppIcons.check className="size-3" />
        Available
      </span>
    );
  }
  if (availability.status === "unavailable" || availability.status === "invalid") {
    return (
      <span className="text-xs font-medium text-destructive">{availability.message}</span>
    );
  }
  if (availability.status === "current") {
    return <span className="text-xs text-muted-foreground">Current handle</span>;
  }
  return null;
}

function PreferencesSection({
  onLaunchAssistantChange,
  onOpenFulfillment,
  showLaunchAssistant,
}: {
  onLaunchAssistantChange: (checked: boolean) => void;
  onOpenFulfillment: () => void;
  showLaunchAssistant: boolean;
  tenantId: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SectionIntro
        description="Browser and checkout defaults for day-to-day work."
        title="Preferences"
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Dashboard</CardTitle>
            <CardDescription>Stored in this browser for the current shop.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field className="rounded-lg border p-3" orientation="horizontal">
              <FieldContent>
                <FieldTitle>Launch assistant</FieldTitle>
                <FieldDescription>
                  Show the floating setup assistant on Overview.
                </FieldDescription>
              </FieldContent>
              <Switch checked={showLaunchAssistant} onCheckedChange={onLaunchAssistantChange} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Commerce defaults</CardTitle>
            <CardDescription>Currency and checkout options for this shop.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
              <p className="font-medium text-foreground">Currency · ETB</p>
              <p className="mt-1 text-muted-foreground">
                Storefront prices and fees use Ethiopian Birr. Multi-currency is not available yet.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Delivery, pickup, and phone confirmation live under Fulfillment.
            </p>
            <Button
              className="w-fit rounded-full"
              onClick={onOpenFulfillment}
              size="sm"
              type="button"
              variant="outline"
            >
              Open fulfillment
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FulfillmentSection({
  currencyId,
  deliveryFeeId,
  deliveryState,
  isPending,
  onDeliveryChange,
  onSaveDelivery,
  onSaveFee,
  savingFee,
}: {
  currencyId: string;
  deliveryFeeId: string;
  deliveryState: Delivery | null;
  isPending: boolean;
  onDeliveryChange: (value: Delivery) => void;
  onSaveDelivery: (value: Delivery, label?: string) => void;
  onSaveFee: () => void;
  savingFee: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SectionIntro
        description="How customers receive orders at checkout. Switches save immediately."
        title="Fulfillment"
      />
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Checkout options</CardTitle>
          <CardDescription>Control delivery, pickup, and order details collection.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {deliveryState ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {deliveryLabels.map((item) => (
                  <Field className="rounded-lg border p-3" key={item.key} orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>{item.label}</FieldTitle>
                      <FieldDescription>{item.description}</FieldDescription>
                    </FieldContent>
                    <Switch
                      checked={deliveryState[item.key]}
                      disabled={isPending}
                      onCheckedChange={(checked) =>
                        onSaveDelivery(
                          {
                            ...deliveryState,
                            [item.key]: checked,
                          },
                          item.label,
                        )
                      }
                    />
                  </Field>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={deliveryFeeId}>Default delivery fee</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <InputGroupText>ETB</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      disabled={savingFee}
                      id={deliveryFeeId}
                      min="0"
                      onChange={(event) =>
                        onDeliveryChange({
                          ...deliveryState,
                          defaultDeliveryFee: event.target.value,
                        })
                      }
                      step="0.01"
                      type="number"
                      value={deliveryState.defaultDeliveryFee}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-busy={savingFee}
                        className="rounded-full"
                        disabled={savingFee || isPending}
                        onClick={onSaveFee}
                        size="xs"
                        type="button"
                        variant="secondary"
                      >
                        {savingFee ? (
                          <>
                            <AppIcons.loader className="animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save"
                        )}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>Applied when delivery is enabled at checkout.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor={currencyId}>Currency</FieldLabel>
                  <Input disabled id={currencyId} readOnly value="ETB" />
                  <FieldDescription>Shop currency is fixed to Ethiopian Birr.</FieldDescription>
                </Field>
              </div>
            </>
          ) : (
            <Alert>
              <AlertTitle>Fulfillment settings are unavailable</AlertTitle>
              <AlertDescription>Try again after checkout setup is complete.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StorefrontSection({
  storefrontTemplates,
  summary,
}: {
  storefrontTemplates: StorefrontTemplateCatalogItem[];
  summary: MerchantDashboardAccess;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SectionIntro
        description="Template selection and publish state for the customer-facing shop."
        title="Storefront"
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Design</CardTitle>
            <CardDescription>
              Starting template customers see after you publish.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {storefrontTemplates.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {storefrontTemplates.map((template) => (
                  <StorefrontTemplateOption
                    currentTemplateKey={summary.storefront.templateKey}
                    key={template.version.templateKey}
                    template={template}
                    tenantId={summary.tenant.id}
                  />
                ))}
              </div>
            ) : (
              <Alert>
                <AlertTitle>No storefronts available</AlertTitle>
                <AlertDescription>
                  Storefront selection will be available after templates are seeded.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Publication</span>
              <Badge variant={summary.storefront.isPublished ? "default" : "outline"}>
                {summary.storefront.isPublished ? "Published" : "Draft"}
              </Badge>
            </div>
            <SettingsRow
              label="Selected design"
              value={getSelectedTemplateName(storefrontTemplates, summary)}
            />
            <SettingsRow
              label="Version"
              value={
                summary.storefront.templateVersion
                  ? `v${summary.storefront.templateVersion}`
                  : "Not selected"
              }
            />
            <div className="flex flex-col gap-2 pt-1">
              <Button asChild className="rounded-full" size="sm" variant="outline">
                <a href={dashboardRoutes.editor}>Edit storefront</a>
              </Button>
              <Button asChild className="rounded-full" size="sm">
                <a href={`//${summary.domain.hostname}`} rel="noreferrer" target="_blank">
                  View shop
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionIntro({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function formatHandleReason(reason: string | undefined) {
  if (reason === "taken" || reason === "handle_unavailable") return "Already taken";
  if (reason === "invalid" || reason === "invalid_handle") return "Invalid handle format";
  if (reason === "reserved") return "This handle is reserved";
  return "Not available";
}
