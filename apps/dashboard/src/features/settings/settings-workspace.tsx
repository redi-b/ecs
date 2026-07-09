"use client";

import type {
  DeliverySettings,
  MerchantDashboardSummary,
  StorefrontTemplateCatalogItem,
} from "@ecs/contracts";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isLaunchAssistantHidden,
  setLaunchAssistantHidden,
} from "@/lib/launch-assistant-preferences";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { Delivery, DeliveryKey, SettingsWorkspaceProps } from "@/features/settings/settings-types";
import { deliveryLabels } from "@/features/settings/settings-types";
import {
  getSelectedTemplateName,
  statusCopy,
} from "@/features/settings/settings-helpers";
import {
  SettingsLinkRow,
  SettingsRow,
  StorefrontTemplateOption,
  StorefrontTemplatePreview,
} from "@/features/settings/settings-sections";

export function SettingsWorkspace({
  delivery,
  initialTab,
  settingsStatus,
  storefrontTemplates,
  summary,
  templateStatus,
}: SettingsWorkspaceProps) {
  const [name, setName] = useState(summary.tenant.name);
  const [handle, setHandle] = useState(summary.tenant.handle);
  const [deliveryState, setDeliveryState] = useState<Delivery | null>(delivery);
  const [message, setMessage] = useState<string | null>(
    settingsStatus || templateStatus ? statusCopy(settingsStatus ?? templateStatus ?? "") : null,
  );
  const [showLaunchAssistant, setShowLaunchAssistant] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const nameId = useId();
  const handleId = useId();
  const deliveryFeeId = useId();
  const currencyId = useId();
  const currentHost = summary.domain.hostname;
  const baseDomain = currentHost.split(".").slice(1).join(".") || "lvh.me";
  const nextHost = `${handle.trim().toLowerCase() || summary.tenant.handle}.${baseDomain}`;
  const handleChanged = handle.trim().toLowerCase() !== summary.tenant.handle;
  const canSaveShop = name.trim().length >= 2 && handle.trim().length >= 3;

  useEffect(() => {
    setShowLaunchAssistant(!isLaunchAssistantHidden(summary.tenant.id));
  }, [summary.tenant.id]);

  function saveDelivery(nextDelivery: Delivery) {
    setDeliveryState(nextDelivery);
    setMessage("Saving fulfillment settings...");

    startTransition(async () => {
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
        setDeliveryState(deliveryState);
        setMessage("Could not save fulfillment settings.");
        return;
      }

      setMessage("Fulfillment settings saved.");
    });
  }

  function saveShopSettings() {
    setMessage("Updating shop address...");

    startTransition(async () => {
      const response = await fetch(
        `${dashboardRoutes.settings}/actions?tenantId=${summary.tenant.id}`,
        {
          body: JSON.stringify({
            mode: "shop",
            name,
            handle,
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
        setMessage(body.error ? statusCopy(body.error) : "Could not save shop settings.");
        return;
      }

      if (body.redirectTo || handleChanged) {
        window.location.assign(
          body.redirectTo ?? `${window.location.protocol}//${nextHost}/admin/settings`,
        );
        return;
      }

      setDialogOpen(false);
      setMessage("Shop settings saved.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? (
        <Alert>
          <AlertTitle>{message}</AlertTitle>
        </Alert>
      ) : null}

      <Tabs defaultValue={initialTab === "storefront" ? "storefront" : "shop"}>
        <TabsList>
          <TabsTrigger value="shop">Shop</TabsTrigger>
          <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
          <TabsTrigger value="storefront">Storefront</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="mt-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Shop Details</CardTitle>
                <CardDescription>
                  Update the public shop name and platform subdomain.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={nameId}>Shop name</FieldLabel>
                    <Input
                      id={nameId}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={handleId}>Shop handle</FieldLabel>
                    <Input
                      id={handleId}
                      pattern="[a-z0-9][a-z0-9-]{1,61}[a-z0-9]"
                      value={handle}
                      onChange={(event) => setHandle(event.target.value)}
                    />
                    <FieldDescription>{nextHost}</FieldDescription>
                  </Field>
                </FieldGroup>
                {handleChanged ? (
                  <Alert>
                    <AlertTitle>Changing the shop address</AlertTitle>
                    <AlertDescription>
                      The current subdomain stops resolving and this dashboard moves to the new
                      address after the update.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    disabled={!canSaveShop || isPending}
                    type="button"
                    onClick={() => (handleChanged ? setDialogOpen(true) : saveShopSettings())}
                  >
                    {isPending ? "Saving..." : "Save shop"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="self-start">
              <CardHeader>
                <CardTitle>Address</CardTitle>
                <CardDescription>Subdomain used by customers and staff.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <SettingsLinkRow
                  label={handleChanged ? "Current" : "Address"}
                  value={currentHost}
                />
                {handleChanged ? <SettingsLinkRow label="After save" value={nextHost} /> : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fulfillment" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Checkout Fulfillment</CardTitle>
              <CardDescription>Switches save immediately.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {deliveryState ? (
                <>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {deliveryLabels.map((item) => (
                      <Field
                        className="rounded-lg border p-3"
                        orientation="horizontal"
                        key={item.key}
                      >
                        <FieldContent>
                          <FieldTitle>{item.label}</FieldTitle>
                          <FieldDescription>{item.description}</FieldDescription>
                        </FieldContent>
                        <Switch
                          checked={deliveryState[item.key]}
                          disabled={isPending}
                          onCheckedChange={(checked) =>
                            saveDelivery({
                              ...deliveryState,
                              [item.key]: checked,
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={deliveryFeeId}>Default delivery fee</FieldLabel>
                      <Input
                        id={deliveryFeeId}
                        type="number"
                        min="0"
                        step="0.01"
                        value={deliveryState.defaultDeliveryFee}
                        onChange={(event) =>
                          setDeliveryState({
                            ...deliveryState,
                            defaultDeliveryFee: event.target.value,
                          })
                        }
                        onBlur={() => deliveryState && saveDelivery(deliveryState)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={currencyId}>Currency</FieldLabel>
                      <Input id={currencyId} value="ETB" disabled readOnly />
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
        </TabsContent>

        <TabsContent value="storefront" className="mt-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Storefront Design</CardTitle>
                <CardDescription>
                  Choose the storefront starting point customers will see after publishing.
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

            <Card className="self-start">
              <CardHeader>
                <CardTitle>Storefront Status</CardTitle>
                <CardDescription>Selected design and publishing state.</CardDescription>
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
                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline">
                    <a href={dashboardRoutes.editor}>Edit storefront</a>
                  </Button>
                  <Button asChild>
                    <a href={`//${summary.domain.hostname}`} rel="noreferrer" target="_blank">
                      View shop
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="account" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Signed-in dashboard user and local preferences.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <SettingsRow label="Name" value={summary.actor.name ?? "Not set"} />
                <SettingsRow label="Email" value={summary.actor.email} />
                <SettingsRow label="Role" value={summary.actor.role} />
              </div>
              <Field className="rounded-lg border p-3" orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Launch assistant</FieldTitle>
                  <FieldDescription>
                    Show the floating setup assistant on Overview.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  checked={showLaunchAssistant}
                  onCheckedChange={(checked) => {
                    setLaunchAssistantHidden(summary.tenant.id, !checked);
                    setShowLaunchAssistant(checked);
                    toast(checked ? "Launch assistant enabled" : "Launch assistant hidden");
                  }}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={isPending} type="button" onClick={saveShopSettings}>
              {isPending ? "Updating..." : "Change address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

