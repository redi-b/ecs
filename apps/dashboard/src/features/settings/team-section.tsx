"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

import { AppIcons } from "@/components/app/icons";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { SearchableCombobox } from "@/components/app/searchable-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SectionIntro,
  SettingsPanel,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { MerchantTeam } from "@/lib/platform-api/team";
import { cn } from "@/lib/utils";
import { teamErrorKey } from "./team-errors";
import { invitationUrl, telegramInvitationShareUrl } from "./team-invitation-links";
import { roleKey } from "./team-role-name";

type TeamRole = MerchantTeam["team"]["roles"][number];
type TeamMember = MerchantTeam["team"]["members"][number];
type BuiltInRole = MerchantTeam["builtInRoles"][number];
type TeamInvitation = MerchantTeam["team"]["invitations"][number];

const BUILT_IN_ROLES = ["owner", "manager", "staff", "viewer"] as const;
const PERMISSION_GROUPS = [
  {
    id: "commerce",
    resources: [
      ["orders", ["read", "create", "update", "cancel", "refund", "export"]],
      ["products", ["read", "create", "update", "publish", "delete", "import", "export"]],
      ["customers", ["read", "update", "export"]],
      ["promotions", ["read", "manage"]],
    ],
  },
  {
    id: "storeOperations",
    resources: [
      ["inquiries", ["read", "update"]],
      ["media", ["read", "manage"]],
      ["storefront", ["read", "edit", "publish"]],
      ["notifications", ["read", "manage"]],
    ],
  },
  {
    id: "businessSettings",
    resources: [
      ["overview", ["read"]],
      ["insights", ["read"]],
      ["settings", ["read", "manage"]],
      ["domains", ["manage"]],
      ["payments", ["manage"]],
      ["billing", ["read", "manage"]],
    ],
  },
] as const;
const BUILT_IN_PERMISSION_GROUP = {
  id: "teamAccess",
  resources: [
    ["team", ["read", "invite", "manage", "roles"]],
    ["ownership", ["transfer"]],
  ],
} as const;

function roleLabel(role: string) {
  return role.replace(/[-_]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

async function teamMutation(path: string, method: "DELETE" | "PATCH" | "POST", body?: unknown) {
  const response = await fetch(`/dashboard/settings/team/${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { accept: "application/json", "content-type": "application/json" },
    method,
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; data?: unknown };
  if (!response.ok) throw new Error(data.error || "team_update_failed");
  return data;
}

export function TeamSection({ initialTeam }: { initialTeam: MerchantTeam | null }) {
  const { formatDate, t } = useI18n();
  const [team, setTeam] = useState(initialTeam);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "roles">("members");
  const [editingRole, setEditingRole] = useState<TeamRole | null>(null);
  const [viewingRole, setViewingRole] = useState<BuiltInRole | null>(null);
  const [shareInvitation, setShareInvitation] = useState<TeamInvitation | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | {
    description: string;
    label: string;
    method: "DELETE" | "POST";
    path: string;
    success: string;
  }>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const response = await fetch("/dashboard/settings/team", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as MerchantTeam | null;
    if (!response.ok || !data?.ok) throw new Error("team_refresh_failed");
    setTeam(data);
    return data;
  }

  function mutate(
    path: string,
    method: "DELETE" | "PATCH" | "POST",
    body: unknown,
    messages: { error: string; loading: string; success: string },
    after?: (team: MerchantTeam) => void,
  ) {
    startTransition(() => {
      const work = teamMutation(path, method, body)
        .then(refresh)
        .then((nextTeam) => after?.(nextTeam));
      toast.promise(work, {
        ...messages,
        error: (error: unknown) => {
          const key = teamErrorKey(error);
          return key ? t(key) : messages.error;
        },
      });
    });
  }

  async function copyInvitation(invitation: TeamInvitation) {
    if (!team) return;
    const copied = await copyTextToClipboard(
      invitationUrl(team.invitationAcceptBaseUrl, invitation.id, team.invitationTenantId),
    );
    if (copied) toast.success(t("settings.team.linkCopied"));
    else toast.error(t("settings.team.linkCopyFailed"));
  }

  function shareInvitationOnTelegram(invitation: TeamInvitation) {
    if (!team) return;
    const invite = invitationUrl(
      team.invitationAcceptBaseUrl,
      invitation.id,
      team.invitationTenantId,
    );
    const share = telegramInvitationShareUrl(invite, t("settings.team.telegramShareMessage"));
    window.open(share, "_blank", "noopener,noreferrer");
  }

  if (!team) {
    return (
      <SettingsSectionBody>
        <SectionIntro
          description={t("settings.team.unavailableDescription")}
          title={t("settings.team.title")}
        />
        <SettingsPanel title={t("settings.team.unavailableTitle")}>
          <p className="text-sm text-muted-foreground">
            {t("settings.team.unavailableDescription")}
          </p>
        </SettingsPanel>
      </SettingsSectionBody>
    );
  }

  const customRoleNames = team.team.roles.map((role) => role.role);
  const availableRoles = [
    ...BUILT_IN_ROLES.filter((role) => role !== "owner" || team.capabilities.canManageRoles),
    ...customRoleNames,
  ];

  return (
    <SettingsSectionBody>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <SectionIntro title={t("settings.team.title")} />
        {team.capabilities.canInvite ? (
          <Button className="w-full rounded-full sm:w-auto" onClick={() => setInviteOpen(true)}>
            <AppIcons.add className="size-4" />
            {t("settings.team.invite")}
          </Button>
        ) : null}
      </div>

      <SegmentedControl
        active="muted"
        ariaLabel={t("settings.team.tabsAria")}
        className="max-w-sm"
        onChange={setActiveTab}
        options={[
          { id: "members", label: t("settings.team.members") },
          { id: "roles", label: t("settings.team.roles") },
        ]}
        value={activeTab}
      />

      {activeTab === "members" ? (
        <div className="space-y-4 motion-safe:animate-dialog-step-in">
          <SettingsPanel
            contentClassName="p-0"
            description={t("settings.team.membersDescription")}
            title={t("settings.team.members")}
          >
            <div className="divide-y divide-border/60">
              {team.team.members.map((member) => {
                const isCurrent = member.userId === team.currentUserId;
                return (
                  <div className="flex min-w-0 items-center gap-3 px-4 py-3" key={member.id}>
                    <ProfileAvatar
                      className="size-9 shrink-0"
                      userId={member.userId}
                      name={member.name}
                      preferences={member.avatar}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        {isCurrent ? (
                          <Badge variant="secondary">{t("settings.team.you")}</Badge>
                        ) : null}
                        {member.status !== "active" ? (
                          <Badge variant="outline">{t("settings.team.suspended")}</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <span className="hidden text-sm text-muted-foreground sm:block">
                      {roleLabel(member.role)}
                    </span>
                    {team.capabilities.canManage && !isCurrent ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={t("settings.team.memberActions")}
                            size="icon"
                            variant="ghost"
                          >
                            <AppIcons.more className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 p-1.5">
                          <DropdownMenuItem onSelect={() => setEditingMember(member)}>
                            {t("settings.team.changeRole")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              mutate(
                                `members/${member.id}/status`,
                                "PATCH",
                                { status: member.status === "active" ? "suspended" : "active" },
                                {
                                  error: t("settings.team.updateFailed"),
                                  loading: t("settings.team.updating"),
                                  success:
                                    member.status === "active"
                                      ? t("settings.team.memberSuspended")
                                      : t("settings.team.memberReactivated"),
                                },
                              )
                            }
                          >
                            {member.status === "active"
                              ? t("settings.team.suspend")
                              : t("settings.team.reactivate")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() =>
                              setConfirmAction({
                                description: t("settings.team.removeDescription", {
                                  name: member.name,
                                }),
                                label: t("settings.team.remove"),
                                method: "DELETE",
                                path: `members/${member.id}`,
                                success: t("settings.team.memberRemoved"),
                              })
                            }
                          >
                            {t("settings.team.remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SettingsPanel>

          {team.team.invitations.length > 0 ? (
            <SettingsPanel
              contentClassName="p-0"
              description={t("settings.team.pendingDescription")}
              title={t("settings.team.pending")}
            >
              <div className="divide-y divide-border/60">
                {team.team.invitations.map((invitation) => (
                  <div className="flex min-w-0 items-center gap-3 px-4 py-3" key={invitation.id}>
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <AppIcons.mail className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabel(invitation.role)} ·{" "}
                        {t("settings.team.expires", {
                          date: formatDate(new Date(invitation.expiresAt)),
                        })}
                      </p>
                    </div>
                    {team.capabilities.canInvite ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={t("settings.team.invitationActions")}
                            size="icon"
                            variant="ghost"
                          >
                            <AppIcons.more className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 p-1.5">
                          <DropdownMenuItem
                            className="min-h-9"
                            onSelect={() => {
                              setShareInvitation(invitation);
                              void copyInvitation(invitation);
                            }}
                          >
                            <AppIcons.copy className="size-4" />
                            {t("settings.team.copyInviteLink")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="min-h-9"
                            onSelect={() => shareInvitationOnTelegram(invitation)}
                          >
                            <AppIcons.telegram className="size-4" />
                            {t("settings.team.shareOnTelegram")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {team.capabilities.emailDeliveryAvailable ? (
                            <DropdownMenuItem
                              className="min-h-9"
                              onSelect={() =>
                                mutate(
                                  "invitations",
                                  "POST",
                                  { email: invitation.email, resend: true, role: invitation.role },
                                  {
                                    error: t("settings.team.inviteFailed"),
                                    loading: t("settings.team.sending"),
                                    success: t("settings.team.invitationResent"),
                                  },
                                )
                              }
                            >
                              <AppIcons.mail className="size-4" />
                              {t("settings.team.resend")}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            className="min-h-9 text-destructive focus:text-destructive"
                            onSelect={() =>
                              setConfirmAction({
                                description: t("settings.team.cancelDescription", {
                                  email: invitation.email,
                                }),
                                label: t("settings.team.cancelInvitation"),
                                method: "POST",
                                path: `invitations/${invitation.id}/cancel`,
                                success: t("settings.team.invitationCancelled"),
                              })
                            }
                          >
                            {t("settings.team.cancelInvitation")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                ))}
              </div>
            </SettingsPanel>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4 motion-safe:animate-dialog-step-in">
          <SettingsPanel
            action={
              team.capabilities.canManageRoles ? (
                <Button
                  className="rounded-full"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingRole(null);
                    setRoleOpen(true);
                  }}
                >
                  <AppIcons.add className="size-4" />
                  {t("settings.team.newRole")}
                </Button>
              ) : null
            }
            contentClassName="p-0"
            description={t("settings.team.rolesDescription")}
            title={t("settings.team.roles")}
          >
            <div className="divide-y divide-border/60">
              {team.builtInRoles.map((role) => (
                <RoleRow
                  builtIn
                  key={role.role}
                  name={role.role}
                  onView={() => setViewingRole(role)}
                />
              ))}
              {team.team.roles.map((role) => (
                <RoleRow
                  key={role.id}
                  name={role.role}
                  {...(team.capabilities.canManageRoles
                    ? {
                        onDelete: () =>
                          setConfirmAction({
                            description: t("settings.team.deleteRoleDescription", {
                              role: roleLabel(role.role),
                            }),
                            label: t("settings.team.deleteRole"),
                            method: "DELETE",
                            path: `roles/${role.id}`,
                            success: t("settings.team.roleDeleted"),
                          }),
                        onEdit: () => {
                          setEditingRole(role);
                          setRoleOpen(true);
                        },
                      }
                    : {})}
                />
              ))}
            </div>
          </SettingsPanel>
        </div>
      )}

      <InviteDialog
        emailDeliveryAvailable={team.capabilities.emailDeliveryAvailable}
        isPending={isPending}
        open={inviteOpen}
        roles={availableRoles}
        onOpenChange={setInviteOpen}
        onSubmit={(body) => {
          if (
            team.team.members.some(
              (member) => member.email.trim().toLowerCase() === body.email.trim().toLowerCase(),
            )
          ) {
            toast.error(t("settings.team.alreadyMember"));
            return;
          }
          mutate(
            "invitations",
            "POST",
            body,
            {
              error: t("settings.team.inviteFailed"),
              loading: t("settings.team.sending"),
              success: t("settings.team.invitationSent"),
            },
            (nextTeam) => {
              const invitation = [...nextTeam.team.invitations]
                .reverse()
                .find((item) => item.email.toLowerCase() === body.email.toLowerCase());
              setInviteOpen(false);
              if (invitation) setShareInvitation(invitation);
            },
          );
        }}
      />

      <InvitationShareDialog
        acceptBaseUrl={team.invitationAcceptBaseUrl}
        emailDeliveryAvailable={team.capabilities.emailDeliveryAvailable}
        invitation={shareInvitation}
        onCopy={() => (shareInvitation ? copyInvitation(shareInvitation) : Promise.resolve())}
        onOpenChange={(open) => !open && setShareInvitation(null)}
        onTelegram={() => shareInvitation && shareInvitationOnTelegram(shareInvitation)}
        tenantId={team.invitationTenantId}
      />

      <MemberRoleDialog
        key={editingMember?.id ?? "no-member"}
        isPending={isPending}
        member={editingMember}
        roles={availableRoles}
        onOpenChange={(open) => !open && setEditingMember(null)}
        onSubmit={(role) => {
          if (!editingMember) return;
          mutate(
            `members/${editingMember.id}/role`,
            "PATCH",
            { role },
            {
              error: t("settings.team.updateFailed"),
              loading: t("settings.team.updating"),
              success: t("settings.team.roleChanged"),
            },
            () => setEditingMember(null),
          );
        }}
      />

      <RoleSheet
        key={editingRole?.id ?? "new-role"}
        isPending={isPending}
        open={roleOpen}
        role={editingRole}
        onOpenChange={setRoleOpen}
        onSubmit={(body) =>
          mutate(
            editingRole ? `roles/${editingRole.id}` : "roles",
            editingRole ? "PATCH" : "POST",
            body,
            {
              error: t("settings.team.roleSaveFailed"),
              loading: t("settings.team.savingRole"),
              success: editingRole
                ? t("settings.team.roleUpdated")
                : t("settings.team.roleCreated"),
            },
            () => setRoleOpen(false),
          )
        }
      />

      <RoleSheet
        isPending={false}
        key={viewingRole?.role ?? "view-role"}
        open={viewingRole !== null}
        readOnly
        role={
          viewingRole
            ? {
                createdAt: "",
                id: viewingRole.role,
                permission: viewingRole.permission,
                role: viewingRole.role,
                updatedAt: null,
              }
            : null
        }
        onOpenChange={(open) => !open && setViewingRole(null)}
        onSubmit={() => undefined}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.label}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.label}
        confirmDisabled={isPending}
        cancelDisabled={isPending}
        onConfirm={(event) => {
          event.preventDefault();
          if (!confirmAction) return;
          const action = confirmAction;
          mutate(
            action.path,
            action.method,
            undefined,
            {
              error: t("settings.team.updateFailed"),
              loading: t("settings.team.updating"),
              success: action.success,
            },
            () => setConfirmAction(null),
          );
        }}
      />
    </SettingsSectionBody>
  );
}

function RoleRow({
  builtIn = false,
  name,
  onDelete,
  onEdit,
  onView,
}: {
  builtIn?: boolean;
  name: string;
  onDelete?: () => void;
  onEdit?: () => void;
  onView?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex size-9 items-center justify-center rounded-full bg-muted">
        <AppIcons.lock className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{roleLabel(name)}</p>
          {builtIn ? <Badge variant="secondary">{t("settings.team.builtIn")}</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {builtIn
            ? t(`settings.team.roleDescriptions.${name}` as never)
            : t("settings.team.customRole")}
        </p>
      </div>
      {onView ? (
        <Button className="rounded-full" size="sm" variant="ghost" onClick={onView}>
          {t("settings.team.viewAccess")}
          <AppIcons.arrowRight className="size-4" />
        </Button>
      ) : onEdit || onDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={t("settings.team.roleActions")} size="icon" variant="ghost">
              <AppIcons.more className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 p-1.5">
            {onEdit ? (
              <DropdownMenuItem onSelect={onEdit}>{t("common.edit")}</DropdownMenuItem>
            ) : null}
            {onEdit && onDelete ? <DropdownMenuSeparator /> : null}
            {onDelete ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={onDelete}
              >
                {t("settings.team.deleteRole")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function InvitationShareDialog({
  acceptBaseUrl,
  emailDeliveryAvailable,
  invitation,
  onCopy,
  onOpenChange,
  onTelegram,
  tenantId,
}: {
  acceptBaseUrl: string;
  emailDeliveryAvailable: boolean;
  invitation: TeamInvitation | null;
  onCopy: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  onTelegram: () => void;
  tenantId: string;
}) {
  const { t } = useI18n();
  const linkId = useId();
  const shareUrl = invitation ? invitationUrl(acceptBaseUrl, invitation.id, tenantId) : "";
  return (
    <Dialog open={invitation !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.team.inviteReadyTitle")}</DialogTitle>
          <DialogDescription>
            {invitation
              ? t(
                  emailDeliveryAvailable
                    ? "settings.team.inviteReadyEmailedDescription"
                    : "settings.team.inviteReadyDescription",
                  { email: invitation.email },
                )
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-1 sm:grid-cols-2">
          <Button className="justify-start rounded-full" variant="outline" onClick={onCopy}>
            <AppIcons.copy className="size-4" />
            {t("settings.team.copyInviteLink")}
          </Button>
          <Button className="justify-start rounded-full" variant="outline" onClick={onTelegram}>
            <AppIcons.telegram className="size-4" />
            {t("settings.team.shareOnTelegram")}
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={linkId}>{t("settings.team.inviteLink")}</Label>
          <Input
            className="font-mono text-xs"
            id={linkId}
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("settings.team.inviteLinkSecurityNote")}
        </p>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("settings.team.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({
  emailDeliveryAvailable,
  isPending,
  onOpenChange,
  onSubmit,
  open,
  roles,
}: {
  emailDeliveryAvailable: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: { email: string; role: string }) => void;
  open: boolean;
  roles: readonly string[];
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const emailId = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.team.inviteTitle")}</DialogTitle>
          <DialogDescription>
            {t(
              emailDeliveryAvailable
                ? "settings.team.inviteEmailDescription"
                : "settings.team.inviteDescription",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor={emailId}>{t("settings.team.email")}</Label>
            <Input
              id={emailId}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.team.role")}</Label>
            <SearchableCombobox
              emptyLabel={t("settings.team.noRolesFound")}
              onChange={setRole}
              options={roles.map((value) => ({ label: roleLabel(value), value }))}
              placeholder={t("settings.team.chooseRole")}
              searchPlaceholder={t("settings.team.searchRoles")}
              value={role}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={isPending || !email.trim()}
            onClick={() => onSubmit({ email: email.trim(), role })}
          >
            {t("settings.team.sendInvite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberRoleDialog({
  isPending,
  member,
  onOpenChange,
  onSubmit,
  roles,
}: {
  isPending: boolean;
  member: TeamMember | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (role: string) => void;
  roles: readonly string[];
}) {
  const { t } = useI18n();
  const [role, setRole] = useState(member?.role ?? "staff");
  const selectedRole = member && role === "staff" ? member.role : role;
  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.team.changeRole")}</DialogTitle>
          <DialogDescription>
            {member ? t("settings.team.changeRoleDescription", { name: member.name }) : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <Label>{t("settings.team.role")}</Label>
          <SearchableCombobox
            emptyLabel={t("settings.team.noRolesFound")}
            onChange={setRole}
            options={roles.map((value) => ({ label: roleLabel(value), value }))}
            placeholder={t("settings.team.chooseRole")}
            searchPlaceholder={t("settings.team.searchRoles")}
            value={selectedRole}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={isPending || selectedRole === member?.role}
            onClick={() => onSubmit(selectedRole)}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleSheet({
  isPending,
  onOpenChange,
  onSubmit,
  open,
  readOnly = false,
  role,
}: {
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: { permission: Record<string, string[]>; role?: string }) => void;
  open: boolean;
  readOnly?: boolean;
  role: TeamRole | null;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(role?.role ?? "");
  const [permission, setPermission] = useState<Record<string, string[]>>(role?.permission ?? {});
  const nameId = useId();
  const normalizedName = roleKey(name);
  const permissionGroups = readOnly
    ? [...PERMISSION_GROUPS, BUILT_IN_PERMISSION_GROUP]
    : PERMISSION_GROUPS;

  function toggle(resource: string, action: string, checked: boolean) {
    const next = { ...permission };
    const hasReadAction = resource !== "domains" && resource !== "payments";
    if (!checked && action === "read") {
      next[resource] = [];
    } else {
      next[resource] = checked
        ? Array.from(
            new Set([
              ...(next[resource] ?? []),
              ...(action !== "read" && hasReadAction ? ["read"] : []),
              action,
            ]),
          )
        : (next[resource] ?? []).filter((value) => value !== action);
    }
    setPermission(next);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl lg:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {readOnly
              ? t("settings.team.roleAccess", { role: roleLabel(role?.role ?? "") })
              : role
                ? t("settings.team.editRole")
                : t("settings.team.newRole")}
          </SheetTitle>
          <SheetDescription>
            {readOnly
              ? t("settings.team.builtInAccessDescription")
              : t("settings.team.roleDialogDescription")}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6">
          {!readOnly ? (
            <div className="space-y-2">
              <Label htmlFor={nameId}>{t("settings.team.roleName")}</Label>
              <Input
                disabled={Boolean(role)}
                id={nameId}
                maxLength={64}
                placeholder={t("settings.team.roleNamePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {!role && normalizedName ? (
                <p className="text-xs text-muted-foreground">
                  {t("settings.team.roleKey", { key: normalizedName })}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-5">
            {permissionGroups.map((group) => (
              <section className="space-y-2" key={group.id}>
                <h3 className="text-sm font-medium">
                  {t(`settings.team.permissionGroups.${group.id}` as never)}
                </h3>
                <div className="rounded-lg border border-border/70">
                  {group.resources.map(([resource, actions], index) => (
                    <div
                      className={cn(
                        "grid gap-3 px-3 py-3 sm:grid-cols-[9rem_1fr]",
                        index > 0 && "border-t border-border/60",
                      )}
                      key={resource}
                    >
                      <p className="text-sm font-medium">
                        {t(`settings.team.permissionResources.${resource}` as never)}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {readOnly &&
                        !actions.some((action) => permission[resource]?.includes(action)) ? (
                          <span className="text-sm text-muted-foreground">
                            {t("settings.team.noAccess")}
                          </span>
                        ) : null}
                        {actions.map((action) => {
                          const granted = permission[resource]?.includes(action) ?? false;
                          if (readOnly && !granted) return null;
                          const id = `permission-${resource}-${action}`;
                          return (
                            <label
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                              htmlFor={readOnly ? undefined : id}
                              key={action}
                            >
                              {readOnly ? (
                                <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <AppIcons.check className="size-3" />
                                </span>
                              ) : (
                                <Checkbox
                                  checked={granted}
                                  id={id}
                                  onCheckedChange={(checked) =>
                                    toggle(resource, action, checked === true)
                                  }
                                />
                              )}
                              {t(`settings.team.permissionActions.${action}` as never)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? t("settings.team.close") : t("common.cancel")}
          </Button>
          {!readOnly ? (
            <Button
              disabled={isPending || normalizedName.length < 2}
              onClick={() => onSubmit({ permission, ...(role ? {} : { role: normalizedName }) })}
            >
              {t("common.save")}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
