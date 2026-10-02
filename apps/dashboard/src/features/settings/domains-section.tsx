"use client";

import type { TenantDomainContract, TenantDomainSetup } from "@ecs/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  SectionIntro,
  SettingsPanel,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";
import { copyTextToClipboard } from "@/lib/clipboard";
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removing, setRemoving] = useState<TenantDomainContract | null>(null);
  const [setupDomain, setSetupDomain] = useState<TenantDomainContract | null>(null);
  const mutationGuard = useRef(false);
  const mutation = useMutation({
    mutationFn: (action: DomainSettingsAction) => mutateDomainSettings({ tenantId, action }),
  });
  const domains = query.data?.domains ?? [];
  const setup = query.data?.setup;
  const customCount = domains.filter((domain) => domain.type === "custom_domain").length;
  const busy = mutation.isPending;

  function errorMessage(error: unknown) {
    const code = error instanceof DomainSettingsError ? error.code : "";
    if (code === "domain_verification_pending") return t("settings.domains.waitingOwnership");
    if (code === "domain_verification_expired") return t("settings.domains.expired");
    if (code === "domain_reconciliation_busy") return t("settings.domains.busy");
    if (code === "domain_invalid") return t("settings.domains.hostnameInvalid");
    if (code === "domain_unavailable") return t("settings.domains.unavailable");
    if (code === "domain_limit_reached") return t("settings.domains.limitReached");
    if (code === "entitlement_required") return t("settings.domains.accessRequired");
    if (code === "custom_domains_unavailable") return t("settings.domains.disabled");
    if (code === "domain_not_verified") return t("settings.domains.notReady");
    return t("settings.domains.actionFailed");
  }

  async function act(action: DomainSettingsAction, renewal = false) {
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
        const others = previous.domains
          .filter((domain) => domain.id !== result.domain.id)
          .map((domain) =>
            action.action === "primary" ? { ...domain, isPrimary: false } : domain,
          );
        return { ...previous, domains: [...others, result.domain] };
      });
      if (action.action === "remove" && result.kind === "removal") {
        setRemoving(null);
        if (result.status === "removed") toast.success(t("settings.domains.removed"));
        else toast.message(t("settings.domains.removingNotice"));
      } else if (action.action === "create") {
        if (!renewal) setHostname("");
        if (!renewal) setAddDialogOpen(false);
        if (result.kind === "domain") setSetupDomain(result.domain);
        toast.success(t(renewal ? "settings.domains.renewed" : "settings.domains.created"));
      } else if (action.action === "primary") toast.success(t("settings.domains.primaryChanged"));
      else if (action.action === "redirect-policy")
        toast.success(t("settings.domains.redirectPolicySaved"));
      else toast.success(t("settings.domains.ownershipVerified"));
      await client.invalidateQueries({ queryKey });
    } catch (error) {
      if (error instanceof DomainSettingsError && error.code === "domain_verification_pending")
        toast.message(errorMessage(error));
      else toast.error(errorMessage(error));
      await client.invalidateQueries({ queryKey });
    } finally {
      mutationGuard.current = false;
    }
  }

  function record(label: string, value: string) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(7rem,auto)_minmax(0,1fr)_auto] items-center gap-3 border-t border-border/60 px-3 py-2.5 first:border-t-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <code className="min-w-0 break-all text-xs leading-relaxed select-all">{value}</code>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`${t("settings.domains.copy")}: ${label}`}
          onClick={async () => {
            if (await copyTextToClipboard(value)) toast.success(t("settings.domains.copied"));
            else toast.error(t("settings.domains.copyFailed"));
          }}
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
        <>
          <SettingsPanel
            title={t("settings.domains.connectTitle")}
            description={setup?.enabled && setup.entitled ? t("settings.domains.limit") : undefined}
            action={
              setup?.enabled && setup.entitled ? (
                <Button type="button" size="sm" onClick={() => setAddDialogOpen(true)}>
                  <AppIcons.link aria-hidden />
                  {t("settings.domains.add")}
                </Button>
              ) : null
            }
          >
            {setup?.enabled && setup.entitled ? (
              <p className="text-sm text-muted-foreground">
                {t("settings.domains.addDescription")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(
                  setup?.enabled && !setup.entitled
                    ? "settings.domains.accessRequired"
                    : "settings.domains.disabled",
                )}
              </p>
            )}
          </SettingsPanel>
          {setup?.enabled && setup.entitled ? (
            <SettingsPanel
              title={t("settings.domains.redirectPolicyTitle")}
              description={t("settings.domains.redirectPolicyDescription")}
              action={
                <Switch
                  checked={query.data.redirectToPrimary}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    void act({ action: "redirect-policy", redirectToPrimary: checked })
                  }
                />
              }
            >
              <p className="text-sm text-muted-foreground">
                {t("settings.domains.redirectPolicyHint")}
              </p>
            </SettingsPanel>
          ) : null}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("settings.domains.addTitle")}</DialogTitle>
                <DialogDescription>{t("settings.domains.addDescription")}</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const normalized = normalizeDomainInput(hostname);
                  setInvalid(!normalized);
                  if (normalized) void act({ action: "create", hostname: normalized });
                }}
                className="flex flex-col gap-3"
              >
                <Field data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor={hostnameId}>{t("settings.domains.hostname")}</FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row">
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
                    <Button type="submit" disabled={busy || customCount >= 2 || !hostname.trim()}>
                      {busy && mutation.variables?.action === "create" ? (
                        <Spinner aria-label={t("settings.domains.adding")} />
                      ) : (
                        <AppIcons.link aria-hidden />
                      )}
                      {t(
                        busy && mutation.variables?.action === "create"
                          ? "settings.domains.adding"
                          : "settings.domains.add",
                      )}
                    </Button>
                  </div>
                  <FieldDescription id={hintId}>
                    {t("settings.domains.hostnameHint")}
                  </FieldDescription>
                  {invalid ? (
                    <FieldError id={errorId}>{t("settings.domains.hostnameInvalid")}</FieldError>
                  ) : null}
                </Field>
                <p className="text-xs text-muted-foreground">{t("settings.domains.dnsOnly")}</p>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      {domains.map((domain) => {
        const managed = domain.type === "platform_subdomain";
        const status = domainConnectionStatus(domain);
        const usable = canUseDomain(domain);
        const expired = initialChallengeExpired(domain, Date.now());
        const removingDomain = status === "removing";
        return (
          <SettingsPanel
            key={domain.id}
            data-domain-row="true"
            title={<span className="break-all">{domain.hostname}</span>}
            action={
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    managed || status === "active"
                      ? "success"
                      : status === "misconfigured" || status === "failed"
                        ? "warning"
                        : "secondary"
                  }
                >
                  {managed
                    ? t(
                        domain.isPrimary
                          ? "settings.domains.primary"
                          : "settings.domains.notPrimary",
                      )
                    : t(`settings.domains.states.${status}`)}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("settings.domains.refreshStatus")}
                    >
                      <AppIcons.more aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuItem className="justify-between gap-3" disabled={!usable} asChild>
                      <a
                        href={`https://${domain.hostname}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("settings.domains.openAddress")}
                        <AppIcons.externalLink aria-hidden />
                      </a>
                    </DropdownMenuItem>
                    {usable && !domain.isPrimary ? (
                      <DropdownMenuItem
                        disabled={busy}
                        onSelect={() => void act({ action: "primary", domainId: domain.id })}
                      >
                        {t("settings.domains.makePrimary")}
                      </DropdownMenuItem>
                    ) : null}
                    {!managed && !removingDomain ? (
                      <>
                        <DropdownMenuItem onSelect={() => setSetupDomain(domain)}>
                          {t(
                            status === "active"
                              ? "settings.domains.viewSetup"
                              : "settings.domains.setup",
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={busy || query.isFetching}
                          onSelect={() => void query.refetch()}
                        >
                          {t("settings.domains.refreshStatus")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={busy}
                          onSelect={() => void act({ action: "verify", domainId: domain.id })}
                        >
                          {t("settings.domains.check")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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
              </div>
            }
          >
            {!managed ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {t(
                    removingDomain
                      ? "settings.domains.removingNotice"
                      : expired
                        ? "settings.domains.expired"
                        : domain.diagnostics
                          ? `settings.domains.diagnostics.${domain.diagnostics.reason}`
                          : status === "pending_verification"
                            ? "settings.domains.waitingOwnership"
                            : status === "pending_dns"
                              ? "settings.domains.waitingDns"
                              : status === "active"
                                ? "settings.domains.ready"
                                : status === "pending_certificate"
                                  ? "settings.domains.waitingCertificate"
                                  : "settings.domains.actionFailed",
                  )}
                </p>
                {domain.diagnostics?.reason === "caa_restricted" && domain.diagnostics.detail ? (
                  <p className="text-sm">
                    {t(`settings.domains.caa.${domain.diagnostics.detail}`)}
                  </p>
                ) : null}
                {domain.warningGraceExpiresAt ? (
                  <p className="text-sm text-warning">
                    {t("settings.domains.grace", {
                      date: formatDateTime(domain.warningGraceExpiresAt),
                    })}
                  </p>
                ) : null}
                {!removingDomain ? (
                  <Dialog
                    open={setupDomain?.id === domain.id}
                    onOpenChange={(open) => !open && setSetupDomain(null)}
                  >
                    <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{domain.hostname}</DialogTitle>
                        <DialogDescription>
                          {t("settings.domains.setupDescription")}
                        </DialogDescription>
                      </DialogHeader>
                      <p className="rounded-lg bg-muted/45 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        {t("settings.domains.propagationHint")}
                      </p>
                      <div className="flex flex-col gap-4">
                        {domain.verificationChallenge ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium">{t("settings.domains.txtTitle")}</p>
                            {record(
                              t("settings.domains.recordName"),
                              domain.verificationChallenge.recordName,
                            )}
                            {record(
                              t("settings.domains.recordValue"),
                              domain.verificationChallenge.recordValue,
                            )}
                            <p className="text-xs text-muted-foreground">
                              {t("settings.domains.keepTxt")}
                            </p>
                          </div>
                        ) : null}
                        {setup ? (
                          <div className="space-y-2 border-t border-border/60 pt-3">
                            <p className="text-xs font-medium">
                              {t("settings.domains.routingTitle")}
                            </p>
                            {record(t("settings.domains.hostname"), domain.hostname)}
                            {record("CNAME / ALIAS", setup.dnsTarget)}
                            <p className="text-xs text-muted-foreground">
                              {t("settings.domains.cname", { target: setup.dnsTarget })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("settings.domains.apex", { target: setup.dnsTarget })}
                            </p>
                            {setup.ingressIpv4.length ? (
                              <details>
                                <summary className="cursor-pointer text-xs">A / IPv4</summary>
                                <p className="pt-2 text-xs text-muted-foreground">
                                  {t("settings.domains.fallback", {
                                    addresses: setup.ingressIpv4.join(", "),
                                  })}
                                </p>
                              </details>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              {t("settings.domains.dnsOnly")}
                            </p>
                          </div>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {t("settings.domains.txtPropagation")}
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : null}
                {domain.diagnostics ? (
                  <p className="text-xs text-muted-foreground">
                    {t("settings.domains.checked", {
                      date: formatDateTime(domain.diagnostics.checkedAt),
                    })}
                  </p>
                ) : null}
              </>
            ) : null}
            <div
              data-slot="domain-list"
              className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
            >
              <span>
                {managed
                  ? t("settings.domains.ecsAddressDescription")
                  : t("settings.domains.propagationHint")}
              </span>
              {usable ? (
                <span className="shrink-0">{t("settings.domains.openAddress")}</span>
              ) : null}
            </div>
          </SettingsPanel>
        );
      })}
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
