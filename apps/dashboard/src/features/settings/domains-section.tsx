"use client";

import type { TenantDomainContract, TenantDomainSetup } from "@ecs/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { HelpTip } from "@/components/app/help-tip";
import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { SectionIntro, SettingsSectionBody } from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  type DomainSettingsAction,
  DomainSettingsError,
  getDomainSettings,
  mutateDomainSettings,
} from "./domain-settings-client";
import {
  canUseDomain,
  domainConnectionStatus,
  initialChallengeExpired,
  normalizeDomainInput,
} from "./domain-settings-model";

export function DomainsSection({
  tenantId,
  initialDomains,
  initialSetup,
  initialRedirectToPrimary = false,
  initialLoadFailed = false,
}: {
  tenantId: string;
  initialDomains: TenantDomainContract[];
  initialSetup?: TenantDomainSetup | undefined;
  initialRedirectToPrimary?: boolean | undefined;
  initialLoadFailed?: boolean | undefined;
}) {
  const { t, formatDateTime } = useI18n();
  const hostnameId = useId();
  const hintId = useId();
  const errorId = useId();
  const client = useQueryClient();
  const queryKey = ["domain-settings", tenantId] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getDomainSettings({ tenantId, signal }),
    ...(initialLoadFailed
      ? {}
      : {
          initialData: {
            domains: initialDomains,
            ...(initialSetup ? { setup: initialSetup } : {}),
            redirectToPrimary: initialRedirectToPrimary,
          },
        }),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (current) =>
      current.state.data?.domains.some(
        (domain) => domain.type === "custom_domain" && domain.status !== "active",
      )
        ? 15_000
        : 60_000,
  });
  const [hostname, setHostname] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [setupDomain, setSetupDomain] = useState<TenantDomainContract | null>(null);
  const [removing, setRemoving] = useState<TenantDomainContract | null>(null);
  const mutationGuard = useRef(false);
  const mutation = useMutation({
    mutationFn: (action: DomainSettingsAction) => mutateDomainSettings({ tenantId, action }),
  });
  const domains = query.data?.domains ?? [];
  const setup = query.data?.setup;
  const customCount = domains.filter((domain) => domain.type === "custom_domain").length;
  const featureAvailable = Boolean(setup?.enabled && setup.entitled);
  const busy = mutation.isPending;

  function errorMessage(error: unknown) {
    const code = error instanceof DomainSettingsError ? error.code : "";
    const key =
      code === "domain_verification_pending"
        ? "waitingOwnership"
        : code === "domain_verification_expired"
          ? "expired"
          : code === "domain_reconciliation_busy"
            ? "busy"
            : code === "domain_invalid"
              ? "hostnameInvalid"
              : code === "domain_unavailable"
                ? "unavailable"
                : code === "domain_limit_reached"
                  ? "limitReached"
                  : code === "entitlement_required"
                    ? "accessRequired"
                    : code === "custom_domains_unavailable"
                      ? "disabled"
                      : code === "domain_not_verified"
                        ? "notReady"
                        : "actionFailed";
    return t(`settings.domains.${key}`);
  }

  async function act(action: DomainSettingsAction) {
    if (mutationGuard.current) return;
    mutationGuard.current = true;
    try {
      await client.cancelQueries({ queryKey });
      const result = await mutation.mutateAsync(action);
      client.setQueryData<typeof query.data>(queryKey, (previous) => {
        if (!previous) return previous;
        if (result.kind === "removal" && action.action === "remove") {
          return {
            ...previous,
            domains:
              result.status === "removed"
                ? previous.domains.filter((domain) => domain.id !== action.domainId)
                : previous.domains.map((domain) =>
                    domain.id === action.domainId
                      ? { ...domain, status: "removing", isPrimary: false }
                      : domain,
                  ),
          };
        }
        if (result.kind !== "domain") return previous;
        return {
          ...previous,
          domains: [
            ...previous.domains
              .filter((domain) => domain.id !== result.domain.id)
              .map((domain) =>
                action.action === "primary" ? { ...domain, isPrimary: false } : domain,
              ),
            result.domain,
          ],
        };
      });
      if (action.action === "remove" && result.kind === "removal") {
        setRemoving(null);
        toast[result.status === "removed" ? "success" : "message"](
          t(
            result.status === "removed"
              ? "settings.domains.removed"
              : "settings.domains.removingNotice",
          ),
        );
      } else if (action.action === "create") {
        setHostname("");
        setAddOpen(false);
        if (result.kind === "domain") setSetupDomain(result.domain);
        toast.success(t("settings.domains.created"));
      } else if (action.action === "primary") toast.success(t("settings.domains.primaryChanged"));
      else if (action.action === "redirect-policy")
        toast.success(t("settings.domains.redirectPolicySaved"));
      else toast.success(t("settings.domains.ownershipVerified"));
      await client.invalidateQueries({ queryKey });
    } catch (error) {
      toast.error(errorMessage(error));
      await client.invalidateQueries({ queryKey });
    } finally {
      mutationGuard.current = false;
    }
  }

  function record(type: string, name: string, value: string) {
    return (
      <div className="grid grid-cols-[auto_minmax(5rem,auto)_minmax(0,1fr)_auto] items-center gap-3 border-t border-border/60 px-3 py-2.5 first:border-t-0">
        <span className="font-mono text-[0.6875rem] font-medium uppercase text-muted-foreground">
          {type}
        </span>
        <span className="text-xs text-muted-foreground">{name}</span>
        <code className="min-w-0 break-all text-xs leading-relaxed select-all">{value}</code>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`${t("settings.domains.copy")}: ${name}`}
          onClick={async () =>
            (await copyTextToClipboard(value))
              ? toast.success(t("settings.domains.copied"))
              : toast.error(t("settings.domains.copyFailed"))
          }
        >
          <AppIcons.copy aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <SettingsSectionBody>
      <SectionIntro title={t("settings.sections.domains.label")} />
      {query.isError || (!query.data && initialLoadFailed) ? (
        <Alert className="items-center gap-3" variant="destructive">
          <AlertDescription className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
            {t(query.data ? "settings.domains.stale" : "settings.domains.loadFailed")}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t("settings.domains.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {query.data ? (
        featureAvailable || domains.length > 0 ? (
          <section className="overflow-hidden rounded-xl border border-border/70 bg-background/70 shadow-sm motion-safe:animate-dialog-step-in">
            <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
              <div className="min-w-0 space-y-1">
                <h3 className="text-[0.9375rem] font-medium tracking-tight">
                  {t("settings.domains.connectTitle")}
                </h3>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {t(
                    featureAvailable
                      ? "settings.domains.addDescription"
                      : setup?.enabled
                        ? "settings.domains.accessRequired"
                        : "settings.domains.disabled",
                  )}
                </p>
                {featureAvailable ? (
                  <p className="text-xs text-muted-foreground">{t("settings.domains.limit")}</p>
                ) : null}
              </div>
              {featureAvailable ? (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 self-start"
                  onClick={() => setAddOpen(true)}
                  disabled={customCount >= 2}
                >
                  <AppIcons.add aria-hidden />
                  {t("settings.domains.add")}
                </Button>
              ) : null}
            </div>
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(12rem,0.9fr)_auto] gap-4 bg-muted/25 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid sm:px-5">
              <span>{t("settings.domains.addressColumn")}</span>
              <span>{t("settings.domains.statusColumn")}</span>
              <span className="sr-only">{t("settings.domains.actionsColumn")}</span>
            </div>
            <div data-slot="domain-list">
              {domains.map((domain) => {
                const managed = domain.type === "platform_subdomain";
                const status = domainConnectionStatus(domain);
                const usable = canUseDomain(domain);
                const removingDomain = status === "removing";
                const expired = initialChallengeExpired(domain, Date.now());
                const needsSetup = !managed && !usable && !removingDomain;
                const stateText = managed
                  ? t(domain.isPrimary ? "settings.domains.primary" : "settings.domains.notPrimary")
                  : t(`settings.domains.states.${status}`);
                const StatusIcon =
                  managed || status === "active"
                    ? AppIcons.check
                    : status === "misconfigured" || status === "failed"
                      ? AppIcons.error
                      : status === "removing"
                        ? AppIcons.loader
                        : AppIcons.time;
                const detail = managed
                  ? t("settings.domains.ecsAddressDescription")
                  : expired
                    ? t("settings.domains.expired")
                    : domain.diagnostics
                      ? t(`settings.domains.diagnostics.${domain.diagnostics.reason}`)
                      : status === "active"
                        ? t("settings.domains.ready")
                        : status === "pending_verification"
                          ? t("settings.domains.waitingOwnership")
                          : status === "pending_dns"
                            ? t("settings.domains.waitingDns")
                            : status === "pending_certificate"
                              ? t("settings.domains.waitingCertificate")
                              : status === "removing"
                                ? t("settings.domains.removingNotice")
                                : t("settings.domains.actionFailed");
                return (
                  <div
                    key={domain.id}
                    data-domain-row="true"
                    className="grid gap-3 border-t border-border/70 px-4 py-4 first:border-t-0 transition-colors hover:bg-muted/20 motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.9fr)_auto] sm:items-center sm:gap-4 sm:px-5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 break-all text-sm font-medium">
                          {domain.hostname}
                        </span>
                        {managed ? (
                          <Badge variant="outline" className="shrink-0">
                            {t("settings.domains.ecsAddress")}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                      {domain.warningGraceExpiresAt ? (
                        <p className="text-xs text-warning">
                          {t("settings.domains.grace", {
                            date: formatDateTime(domain.warningGraceExpiresAt),
                          })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 sm:justify-start">
                      <Badge
                        className="gap-1.5 whitespace-nowrap"
                        variant={
                          managed || status === "active"
                            ? "success"
                            : status === "misconfigured" || status === "failed"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        <StatusIcon
                          className={cn("size-3.5", status === "removing" && "animate-spin")}
                          aria-hidden
                        />
                        {stateText}
                      </Badge>
                      {domain.diagnostics ? (
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          {t("settings.domains.checked", {
                            date: formatDateTime(domain.diagnostics.checkedAt),
                          })}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      {needsSetup ? (
                        <Button type="button" size="sm" onClick={() => setSetupDomain(domain)}>
                          {t("settings.domains.setup")}
                        </Button>
                      ) : usable ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <a
                            href={`https://${domain.hostname}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t("settings.domains.openAddress")}
                            <AppIcons.externalLink aria-hidden />
                          </a>
                        </Button>
                      ) : null}
                      {!removingDomain ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("settings.domains.actionsColumn")}
                            >
                              <AppIcons.more aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-48">
                            {usable ? (
                              <DropdownMenuItem
                                disabled={domain.isPrimary || busy}
                                onSelect={() =>
                                  void act({ action: "primary", domainId: domain.id })
                                }
                              >
                                {domain.isPrimary
                                  ? t("settings.domains.primary")
                                  : t("settings.domains.makePrimary")}
                              </DropdownMenuItem>
                            ) : null}
                            {!managed ? (
                              <>
                                <DropdownMenuItem
                                  disabled={busy || query.isFetching}
                                  onSelect={() => void query.refetch()}
                                >
                                  {t("settings.domains.refreshStatus")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={busy}
                                  onSelect={() =>
                                    void act({ action: "verify", domainId: domain.id })
                                  }
                                >
                                  {t("settings.domains.checkDns")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setSetupDomain(domain)}>
                                  {t(
                                    usable
                                      ? "settings.domains.viewSetup"
                                      : "settings.domains.setup",
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={busy}
                                  onSelect={() => setRemoving(domain)}
                                >
                                  {t("settings.domains.remove")}
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                    {!managed &&
                    domain.diagnostics?.reason === "caa_restricted" &&
                    domain.diagnostics.detail ? (
                      <p className="text-xs text-warning sm:col-span-3">
                        {t(`settings.domains.caa.${domain.diagnostics.detail}`)}
                      </p>
                    ) : null}
                    {!managed ? (
                      <Dialog
                        open={setupDomain?.id === domain.id}
                        onOpenChange={(open) => !open && setSetupDomain(null)}
                      >
                        <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>
                              {t("settings.domains.setupTitle")}{" "}
                              <span className="font-normal">{domain.hostname}</span>
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="rounded-lg bg-muted/45 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                              {t("settings.domains.propagationHint")}
                            </div>
                            {domain.verificationChallenge ? (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">
                                  {t("settings.domains.txtTitle")}
                                </p>
                                <div className="overflow-hidden rounded-lg border border-border/70">
                                  {record(
                                    "TXT",
                                    t("settings.domains.recordName"),
                                    domain.verificationChallenge.recordName,
                                  )}
                                  {record(
                                    "TXT",
                                    t("settings.domains.recordValue"),
                                    domain.verificationChallenge.recordValue,
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {t("settings.domains.keepTxt")}
                                </p>
                              </div>
                            ) : null}
                            {setup ? (
                              <div className="space-y-2 border-t border-border/70 pt-4">
                                <p className="text-sm font-medium">
                                  {t("settings.domains.routingTitle")}
                                </p>
                                <div className="overflow-hidden rounded-lg border border-border/70">
                                  {record(
                                    "CNAME",
                                    t("settings.domains.recordName"),
                                    domain.hostname,
                                  )}
                                  {record(
                                    "CNAME",
                                    t("settings.domains.recordValue"),
                                    setup.dnsTarget,
                                  )}
                                </div>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {t("settings.domains.cname", { target: setup.dnsTarget })}
                                </p>
                                <details className="text-xs text-muted-foreground">
                                  <summary className="cursor-pointer font-medium text-foreground">
                                    {t("settings.domains.apexTitle")}
                                  </summary>
                                  <p className="pt-2">
                                    {t("settings.domains.apex", { target: setup.dnsTarget })}
                                  </p>
                                  {setup.ingressIpv4.length ? (
                                    <p className="pt-2">
                                      {t("settings.domains.fallback", {
                                        addresses: setup.ingressIpv4.join(", "),
                                      })}
                                    </p>
                                  ) : null}
                                </details>
                              </div>
                            ) : null}
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {customCount > 0 && query.data ? (
              <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {t("settings.domains.redirectPolicyTitle")}
                  </span>
                  <HelpTip
                    label={t("settings.domains.redirectPolicyHelp")}
                    summary={t("settings.domains.redirectPolicyDescription")}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {query.data.redirectToPrimary
                      ? t("settings.domains.redirectOn")
                      : t("settings.domains.redirectOff")}
                  </span>
                  <Switch
                    checked={query.data.redirectToPrimary}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      void act({ action: "redirect-policy", redirectToPrimary: checked })
                    }
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t(setup?.enabled ? "settings.domains.accessRequired" : "settings.domains.disabled")}
          </p>
        )
      ) : null}
      {featureAvailable ? (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("settings.domains.addTitle")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const normalized = normalizeDomainInput(hostname);
                setInvalid(!normalized);
                if (normalized) void act({ action: "create", hostname: normalized });
              }}
              className="flex flex-col gap-4"
            >
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor={hostnameId}>{t("settings.domains.hostname")}</FieldLabel>
                <Input
                  id={hostnameId}
                  name="hostname"
                  value={hostname}
                  onChange={(event) => {
                    setHostname(event.target.value);
                    if (invalid) setInvalid(false);
                  }}
                  placeholder="shop.example.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${errorId} ${hintId}` : hintId}
                  disabled={busy || customCount >= 2}
                />
                <FieldDescription id={hintId}>
                  {t("settings.domains.hostnameHint")}
                </FieldDescription>
                {invalid ? (
                  <FieldError id={errorId}>{t("settings.domains.hostnameInvalid")}</FieldError>
                ) : null}
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={busy || customCount >= 2 || !hostname.trim()}>
                  {busy && mutation.variables?.action === "create" ? (
                    <Spinner aria-label={t("settings.domains.adding")} />
                  ) : null}
                  {t(
                    busy && mutation.variables?.action === "create"
                      ? "settings.domains.adding"
                      : "settings.domains.add",
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!busy && !open) setRemoving(null);
        }}
        title={t("settings.domains.removeTitle")}
        description={t("settings.domains.removeDescription", {
          hostname: removing?.hostname ?? "",
        })}
        confirmLabel={busy ? t("settings.domains.removing") : t("settings.domains.remove")}
        confirmDisabled={busy}
        cancelDisabled={busy}
        onConfirm={(event) => {
          event.preventDefault();
          if (removing) void act({ action: "remove", domainId: removing.id });
        }}
      />
    </SettingsSectionBody>
  );
}
