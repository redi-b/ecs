"use client";

import type { SuperadminSupportHistory } from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatAuditAction } from "@/lib/format-audit-action";
import { beginReauthentication } from "@/lib/reauthentication";

export function SupportWorkspace({
  canCreateNote,
  initialHistory,
  tenantId,
}: {
  canCreateNote: boolean;
  initialHistory: SuperadminSupportHistory["history"];
  tenantId: string;
}) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/support`, {
      cache: "no-store",
    }).catch(() => null);
    if (response?.ok) {
      const data = (await response.json()) as { history: SuperadminSupportHistory["history"] };
      setHistory(data.history);
      return true;
    }
    return false;
  }

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/support`, {
        body: JSON.stringify({ body: body.trim() }),
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "POST",
      }).catch(() => null);
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      if (!response?.ok) {
        if (beginReauthentication(data.error)) return;
        toast.error(
          data.error === "operator_forbidden"
            ? "Your operator access no longer allows internal notes."
            : "Internal support note could not be saved.",
        );
        return;
      }
      setBody("");
      const refreshed = await refresh();
      router.refresh();
      toast.success(
        refreshed
          ? "Internal support note saved."
          : "Internal support note saved. Refresh to see the latest history.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <header className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">Support history</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal notes and a redacted audit timeline. Notes are never shown to the merchant.
        </p>
      </header>
      <div className="flex flex-col gap-6 p-5">
        {canCreateNote ? (
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor={`support-note-${tenantId}`}>Internal note</FieldLabel>
              <Textarea
                id={`support-note-${tenantId}`}
                onChange={(event) => setBody(event.target.value)}
                maxLength={4_000}
                placeholder="Record the context, evidence, and next step…"
                rows={3}
                value={body}
              />
              <FieldDescription>
                Do not include credentials, payment secrets, or customer information. {body.length}
                /4,000
              </FieldDescription>
            </Field>
            <Button
              disabled={busy || body.trim().length < 3}
              onClick={() => void submit()}
              type="button"
            >
              {busy ? <Spinner data-icon="inline-start" /> : null}
              {busy ? "Saving note" : "Add internal note"}
            </Button>
          </div>
        ) : null}

        <div className="grid gap-8 border-t pt-5 lg:grid-cols-2">
          <Timeline
            empty="No internal notes yet."
            items={history.notes.map((note) => ({
              id: note.id,
              title: note.body,
              detail: `${note.operator?.name ?? "ECS operator"} · ${formatDateTime(note.createdAt)}`,
            }))}
            title="Notes"
          />
          <Timeline
            empty="No audited tenant actions yet."
            items={history.auditLogs.map((event) => ({
              id: event.id,
              title: formatAuditAction(event.action),
              detail: `${event.actor?.name ?? "ECS system"} · ${formatDateTime(event.createdAt)}`,
            }))}
            title="Audit timeline"
          />
        </div>
      </div>
    </section>
  );
}

function Timeline({
  empty,
  items,
  title,
}: {
  empty: string;
  items: Array<{ detail: string; id: string; title: string }>;
  title: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-3">
        {items.length ? (
          <ol className="divide-y border-y">
            {items.map((item) => (
              <li className="py-3 first:pt-3 last:pb-3" key={item.id}>
                <p className="break-words text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-ET", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
