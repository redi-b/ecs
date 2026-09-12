"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Braces,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  Heading2,
  Italic,
  List,
  MailCheck,
  Monitor,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Undo2,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { OperationsConfirmDialog } from "@/components/operations-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  EmailTemplateCatalog,
  EmailTemplateDetail,
  EmailTemplateDocument,
} from "@/lib/platform-api/superadmin/email-templates";
import { cn } from "@/lib/utils";

const EmailButton = Node.create({
  name: "emailButton",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      href: { default: "{{action_url}}" },
      label: { default: "Continue" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-email-button]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-email-button": "",
        class:
          "my-4 w-fit rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background",
      }),
      HTMLAttributes.label,
    ];
  },
});

type PreviewMode = "desktop" | "mobile";
type PreviewFixture = "typical" | "long";

export function EmailTemplateWorkspace({
  canPublish,
  canSendTest,
  canUpdate,
  catalog,
}: {
  canPublish: boolean;
  canSendTest: boolean;
  canUpdate: boolean;
  catalog: EmailTemplateCatalog;
}) {
  const [templateKey, setTemplateKey] = useState(catalog.templates[0]?.key ?? "");
  const [locale, setLocale] = useState<"am" | "en">("en");
  const [detail, setDetail] = useState<EmailTemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!templateKey) return;
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(
        `/api/email-templates/${encodeURIComponent(templateKey)}?locale=${locale}`,
      );
      const data = (await response.json()) as EmailTemplateDetail;
      if (!response.ok) throw new Error("load_failed");
      setDetail(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [locale, templateKey]);

  useEffect(() => void load(), [load]);

  return (
    <div className="grid min-h-[42rem] overflow-hidden rounded-xl bg-card ring-1 ring-foreground/[0.08] xl:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border-b bg-muted/25 xl:border-r xl:border-b-0">
        <div className="border-b px-4 py-4">
          <p className="text-sm font-medium">Messages</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Account emails sent by ECS.
          </p>
        </div>
        <nav aria-label="Email templates" className="grid gap-1 p-2">
          {catalog.templates.map((template) => {
            const active = template.key === templateKey;
            const state = template.locales.find((item) => item.locale === locale);
            return (
              <button
                className={cn(
                  "rounded-lg px-3 py-2.5 text-left transition-colors",
                  active ? "bg-background shadow-xs ring-1 ring-border" : "hover:bg-background/70",
                )}
                key={template.key}
                onClick={() => setTemplateKey(template.key)}
                type="button"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{template.label}</span>
                  {state?.publishedVersion ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                  ) : null}
                </span>
                <span className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                  {template.description}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
          <Tabs value={locale} onValueChange={(value) => setLocale(value as "am" | "en")}>
            <TabsList aria-label="Template language">
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="am">አማርኛ</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {catalog.deliveryConfigured ? (
              <>
                <span className="size-1.5 rounded-full bg-emerald-500" /> Email delivery connected
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-amber-500" /> Preview only
              </>
            )}
          </div>
        </div>
        {loading ? <WorkspaceSkeleton /> : null}
        {loadError ? (
          <div className="grid min-h-96 place-items-center p-8 text-center">
            <div>
              <p className="font-medium">Template could not be loaded</p>
              <Button className="mt-4" onClick={() => void load()} variant="outline">
                Try again
              </Button>
            </div>
          </div>
        ) : null}
        {!loading && detail ? (
          <TemplateEditor
            canPublish={canPublish}
            canSendTest={canSendTest}
            canUpdate={canUpdate}
            key={`${detail.templateKey}:${detail.locale}:${detail.updatedAt}`}
            detail={detail}
            deliveryConfigured={catalog.deliveryConfigured}
            onReload={load}
          />
        ) : null}
      </div>
    </div>
  );
}

function TemplateEditor({
  canPublish,
  canSendTest,
  canUpdate,
  deliveryConfigured,
  detail,
  onReload,
}: {
  canPublish: boolean;
  canSendTest: boolean;
  canUpdate: boolean;
  deliveryConfigured: boolean;
  detail: EmailTemplateDetail;
  onReload: () => Promise<void>;
}) {
  const initial = useRef(
    JSON.stringify({
      content: detail.content,
      preheader: detail.preheader,
      replyTo: detail.replyTo,
      subject: detail.subject,
    }),
  );
  const subjectId = useId();
  const preheaderId = useId();
  const replyToId = useId();
  const testRecipientId = useId();
  const [subject, setSubject] = useState(detail.subject);
  const [preheader, setPreheader] = useState(detail.preheader);
  const [replyTo, setReplyTo] = useState(detail.replyTo ?? "");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [previewFixture, setPreviewFixture] = useState<PreviewFixture>("typical");
  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [revision, setRevision] = useState(0);
  const editor = useEditor({
    content: detail.content,
    editable: canUpdate,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ blockquote: false, code: false, codeBlock: false }),
      EmailButton,
    ],
    editorProps: {
      attributes: {
        class:
          "min-h-72 px-5 py-4 text-sm leading-7 outline-none [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-3 [&_ul]:list-disc",
      },
    },
    onUpdate: () => setRevision((value) => value + 1),
  });

  const content = useMemo(() => {
    void revision;
    return (editor?.getJSON() ?? detail.content) as EmailTemplateDocument;
  }, [detail.content, editor, revision]);
  const serialized = JSON.stringify({ content, preheader, replyTo: replyTo || null, subject });
  const dirty = serialized !== initial.current;

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/email-templates/${encodeURIComponent(detail.templateKey)}/preview`,
          {
            body: JSON.stringify({
              content,
              locale: detail.locale,
              preheader,
              subject,
              variables:
                previewFixture === "long" ? getLongFixture(detail.fixtures) : detail.fixtures,
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
            signal: controller.signal,
          },
        );
        const data = (await response.json()) as { html?: string };
        if (response.ok && data.html) setPreviewHtml(data.html);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setPreviewHtml("");
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    content,
    detail.fixtures,
    detail.locale,
    detail.templateKey,
    preheader,
    previewFixture,
    subject,
  ]);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/email-templates/${encodeURIComponent(detail.templateKey)}/draft`,
        {
          body: JSON.stringify({
            content,
            locale: detail.locale,
            preheader,
            replyTo: replyTo || null,
            senderProfile: detail.senderProfile,
            subject,
          }),
          headers: { "content-type": "application/json" },
          method: "PUT",
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(formatTemplateError(data.error));
      initial.current = serialized;
      toast.success("Draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Draft could not be saved");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      if (dirty) await saveOrThrow();
      const response = await fetch(
        `/api/email-templates/${encodeURIComponent(detail.templateKey)}/publish`,
        {
          body: JSON.stringify({ locale: detail.locale }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        version?: number;
      };
      if (!response.ok) throw new Error(formatTemplateError(data.error));
      setPublishOpen(false);
      toast.success(`Version ${data.version} published`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Template could not be published");
    } finally {
      setPublishing(false);
    }
  }

  async function saveOrThrow() {
    const response = await fetch(
      `/api/email-templates/${encodeURIComponent(detail.templateKey)}/draft`,
      {
        body: JSON.stringify({
          content,
          locale: detail.locale,
          preheader,
          replyTo: replyTo || null,
          senderProfile: detail.senderProfile,
          subject,
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(formatTemplateError(data.error));
    initial.current = serialized;
  }

  async function sendTest() {
    setSendingTest(true);
    try {
      const response = await fetch(
        `/api/email-templates/${encodeURIComponent(detail.templateKey)}/test`,
        {
          body: JSON.stringify({
            content,
            locale: detail.locale,
            preheader,
            recipient: testRecipient,
            replyTo: replyTo || null,
            senderProfile: detail.senderProfile,
            subject,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(formatTemplateError(data.error));
      setTestOpen(false);
      toast.success("Test email sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test email could not be sent");
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{detail.label}</h2>
            {detail.publishedVersion ? (
              <Badge variant="secondary">Live v{detail.publishedVersion}</Badge>
            ) : (
              <Badge variant="outline">Default</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">From {detail.senderProfile}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RevisionMenu canUpdate={canUpdate} detail={detail} onReload={onReload} />
          {canSendTest ? (
            <Button
              disabled={!deliveryConfigured}
              onClick={() => setTestOpen(true)}
              size="sm"
              variant="outline"
            >
              <Send /> Send test
            </Button>
          ) : null}
          {canUpdate ? (
            <Button
              disabled={!dirty || saving}
              onClick={() => void save()}
              size="sm"
              variant="outline"
            >
              <Save /> {saving ? "Saving" : "Save draft"}
            </Button>
          ) : null}
          {canPublish ? (
            <Button onClick={() => setPublishOpen(true)} size="sm">
              <MailCheck /> Publish
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 2xl:grid-cols-[minmax(25rem,0.9fr)_minmax(28rem,1.1fr)]">
        <div className="min-w-0 border-b 2xl:border-r 2xl:border-b-0">
          <div className="grid gap-4 border-b p-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={subjectId}>Subject</Label>
              <Input
                disabled={!canUpdate}
                id={subjectId}
                maxLength={200}
                onChange={(event) => setSubject(event.target.value)}
                value={subject}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={preheaderId}>Preview text</Label>
              <Input
                disabled={!canUpdate}
                id={preheaderId}
                maxLength={300}
                onChange={(event) => setPreheader(event.target.value)}
                value={preheader}
              />
              <p className="text-xs text-muted-foreground">
                Shown beside the subject in many inboxes.
              </p>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={replyToId}>
                Reply-to <span className="font-normal text-muted-foreground">Optional</span>
              </Label>
              <Input
                disabled={!canUpdate}
                id={replyToId}
                onChange={(event) => setReplyTo(event.target.value)}
                placeholder="support@example.com"
                type="email"
                value={replyTo}
              />
            </div>
          </div>
          <div
            className={cn(
              "sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-background/95 p-2 backdrop-blur",
              !canUpdate && "pointer-events-none opacity-50",
            )}
          >
            <EditorButton
              active={editor?.isActive("bold")}
              label="Bold"
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold />
            </EditorButton>
            <EditorButton
              active={editor?.isActive("italic")}
              label="Italic"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic />
            </EditorButton>
            <EditorButton
              active={editor?.isActive("heading", { level: 2 })}
              label="Heading"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 />
            </EditorButton>
            <EditorButton
              active={editor?.isActive("bulletList")}
              label="List"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List />
            </EditorButton>
            <span className="mx-1 h-5 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  <Braces /> Insert variable <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Safe variables</DropdownMenuLabel>
                {detail.allowedVariables.map((variable) => (
                  <DropdownMenuItem
                    key={variable}
                    onClick={() => editor?.chain().focus().insertContent(`{{${variable}}}`).run()}
                  >
                    {humanize(variable)}{" "}
                    <span className="ml-auto pl-6 font-mono text-xs text-muted-foreground">{`{{${variable}}}`}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .insertContent({
                    attrs: { href: "{{action_url}}", label: "Continue" },
                    type: "emailButton",
                  })
                  .run()
              }
              size="sm"
              variant="ghost"
            >
              Add button
            </Button>
            <span className="ml-auto" />
            <EditorButton
              disabled={!editor?.can().undo()}
              label="Undo"
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 />
            </EditorButton>
            <EditorButton
              disabled={!editor?.can().redo()}
              label="Redo"
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 />
            </EditorButton>
          </div>
          <ScrollArea className="h-[31rem]">
            <EditorContent editor={editor} className={cn(!canUpdate && "pointer-events-none")} />
          </ScrollArea>
        </div>

        <section className="min-w-0 bg-muted/25">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="size-4" /> Preview
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    {previewFixture === "typical" ? "Typical content" : "Long content"}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setPreviewFixture("typical")}>
                    Typical content
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPreviewFixture("long")}>
                    Long names and text
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tabs
                value={previewMode}
                onValueChange={(value) => setPreviewMode(value as PreviewMode)}
              >
                <TabsList aria-label="Preview size">
                  <TabsTrigger aria-label="Desktop preview" value="desktop">
                    <Monitor />
                  </TabsTrigger>
                  <TabsTrigger aria-label="Mobile preview" value="mobile">
                    <Smartphone />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          <div className="grid min-h-[35rem] place-items-start overflow-auto p-4 sm:p-6">
            <div
              className={cn(
                "mx-auto overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10 transition-[width] duration-300",
                previewMode === "mobile" ? "w-[23.5rem] max-w-full" : "w-full max-w-[48rem]",
              )}
            >
              {previewHtml ? (
                <iframe
                  className="h-[36rem] w-full bg-white"
                  sandbox=""
                  srcDoc={previewHtml}
                  title={`${detail.label} preview`}
                />
              ) : (
                <div className="grid h-[36rem] place-items-center text-sm text-neutral-500">
                  Preview unavailable
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <OperationsConfirmDialog
        cancelLabel="Keep editing"
        confirmLabel="Publish version"
        description="This version will be used for new emails. Existing versions remain available in history."
        onConfirm={publish}
        onOpenChange={setPublishOpen}
        open={publishOpen}
        pending={publishing}
        title={`Publish ${detail.label}?`}
        tone="default"
      />
      <OperationsConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Send test"
        description={
          <div className="grid gap-2 text-left">
            <span>Preview variables will be used. The subject will start with “Test”.</span>
            <Label htmlFor={testRecipientId}>Recipient</Label>
            <Input
              id={testRecipientId}
              onChange={(event) => setTestRecipient(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={testRecipient}
            />
          </div>
        }
        onConfirm={sendTest}
        onOpenChange={setTestOpen}
        open={testOpen}
        pending={sendingTest}
        title="Send a test email"
        tone="default"
        disabled={!testRecipient.trim()}
      />
    </div>
  );
}

function RevisionMenu({
  canUpdate,
  detail,
  onReload,
}: {
  canUpdate: boolean;
  detail: EmailTemplateDetail;
  onReload: () => Promise<void>;
}) {
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function restore() {
    if (restoreVersion == null) return;
    setRestoring(true);
    try {
      const response = await fetch(
        `/api/email-templates/${encodeURIComponent(detail.templateKey)}/restore`,
        {
          body: JSON.stringify({ locale: detail.locale, version: restoreVersion }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      if (!response.ok) throw new Error("restore_failed");
      toast.success(`Version ${restoreVersion} copied to draft`);
      setRestoreVersion(null);
      await onReload();
    } catch {
      toast.error("Version could not be restored");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={!detail.versions.length} size="sm" variant="ghost">
            <Clock3 /> History <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Published versions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {detail.versions.map((revision) => (
            <DropdownMenuItem
              disabled={!canUpdate || revision.version === detail.publishedVersion}
              key={revision.version}
              onSelect={() => setRestoreVersion(revision.version)}
            >
              <span className="flex flex-col">
                <span>Version {revision.version}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(revision.publishedAt)}
                </span>
              </span>
              {revision.version === detail.publishedVersion ? (
                <Check className="ml-auto" />
              ) : (
                <RotateCcw className="ml-auto" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <OperationsConfirmDialog
        confirmLabel="Restore draft"
        description={`This copies version ${restoreVersion ?? ""} into the current draft. The live email will not change until you publish it.`}
        onConfirm={() => void restore()}
        onOpenChange={(open) => {
          if (!open && !restoring) setRestoreVersion(null);
        }}
        open={restoreVersion != null}
        pending={restoring}
        title={`Restore version ${restoreVersion ?? ""}?`}
        tone="default"
      />
    </>
  );
}

function EditorButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className={cn(active && "bg-muted")}
      disabled={disabled}
      onClick={onClick}
      size="icon-sm"
      title={label}
      variant="ghost"
    >
      {children}
    </Button>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 p-5 lg:grid-cols-2">
      <div className="h-[34rem] rounded-lg bg-muted" />
      <div className="h-[34rem] rounded-lg bg-muted" />
    </div>
  );
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatTemplateError(value: unknown) {
  if (value === "email_template_variables_invalid")
    return "Add every required variable and remove unsupported variables";
  if (value === "email_delivery_unavailable")
    return "Connect an email provider before sending tests";
  return "Template changes could not be saved";
}

function getLongFixture(fixtures: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(fixtures).map(([key, value]) => {
      if (key === "recipient_name") return [key, "Kidist Selamawit Gebremedhin"];
      if (key === "inviter_name") return [key, "Betelhem Wondimu Tesfaye"];
      if (key === "shop_name") return [key, "Addis Ababa Artisan Home and Lifestyle Market"];
      return [key, value];
    }),
  );
}
