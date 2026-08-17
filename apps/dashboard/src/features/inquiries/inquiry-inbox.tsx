"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { StorefrontInquiry, StorefrontInquiryStatus } from "@/lib/platform-api/inquiries/client";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const statusLabels: Record<StorefrontInquiryStatus, string> = { new: "New", read: "Read", resolved: "Resolved", archived: "Archived" };

export function InquiryInbox({ inquiries, tenantId }: { inquiries: StorefrontInquiry[]; tenantId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<StorefrontInquiry | null>(null);
  const [updating, startTransition] = useTransition();
  const search = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const type = searchParams.get("type") ?? "all";

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key); else params.set(key, value);
    params.delete("page");
    router.replace(`${dashboardRoutes.inquiries}?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("status");
    params.delete("type");
    params.delete("page");
    router.replace(`${dashboardRoutes.inquiries}?${params.toString()}`, { scroll: false });
  }

  async function updateStatus(nextStatus: StorefrontInquiryStatus) {
    if (!selected) return;
    startTransition(async () => {
      const suffix = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      const response = await fetch(`${dashboardRoutes.inquiryAction(selected.id)}${suffix}`, { method: "PATCH", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { toast.error(typeof data.error === "string" ? data.error : "Could not update this inquiry."); return; }
      setSelected(data.inquiry as StorefrontInquiry);
      toast.success(nextStatus === "resolved" ? "Inquiry marked resolved" : `Inquiry marked ${statusLabels[nextStatus].toLowerCase()}`);
      router.refresh();
    });
  }

  useEffect(() => {
    if (selected && !inquiries.some((item) => item.id === selected.id)) setSelected(null);
  }, [inquiries, selected]);

  const toolbar = (
    <DataTableFilters
      filters={[
        {
          defaultValue: "all",
          id: "status",
          label: "Status",
          onChange: (value) => setFilter("status", value),
          options: Object.entries(statusLabels).map(([value, label]) => ({ label, value })),
          value: status,
        },
        {
          defaultValue: "all",
          id: "type",
          label: "Type",
          onChange: (value) => setFilter("type", value),
          options: [
            { label: "Messages", value: "contact" },
            { label: "Product requests", value: "product_request" },
          ],
          value: type,
        },
      ]}
      onClearAll={clearFilters}
    >
      <ListToolbarSearch clearLabel="Clear inquiry search" label="Search inquiries" onChange={(value) => setFilter("q", value)} placeholder="Search name, contact, or subject…" value={search} />
    </DataTableFilters>
  );

  return <>
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/70 bg-muted/15 px-3 py-2.5 sm:px-4">{toolbar}</div>
      {inquiries.length ? <div className="divide-y divide-border/70">{inquiries.map((inquiry) => <button key={inquiry.id} type="button" onClick={() => { setSelected(inquiry.status === "new" ? { ...inquiry, status: "read" } : inquiry); if (inquiry.status === "new") setTimeout(() => void updateStatusFor(inquiry, "read", tenantId, router), 0); }} className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5">
        <span className={cn("mt-1 size-2 rounded-full", inquiry.status === "new" ? "bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_14%,transparent)]" : "bg-muted-foreground/25")} />
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm font-semibold">{inquiry.customerName}</strong><Badge variant="outline" className="rounded-full text-[10px] font-medium">{inquiry.type === "product_request" ? "Product request" : "Message"}</Badge></span><span className="mt-1 block truncate text-sm font-medium text-foreground/85">{inquiry.subject}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{inquiry.message}</span></span>
        <span className="flex flex-col items-end gap-2"><time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={inquiry.createdAt}>{relativeDate(inquiry.createdAt)}</time><AppIcons.arrowRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" /></span>
      </button>)}</div> : <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><span className="mb-4 grid size-11 place-items-center rounded-2xl bg-muted"><AppIcons.mail className="size-5 text-muted-foreground" /></span><h2 className="text-sm font-semibold">No inquiries found</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">New storefront messages and product requests will appear here.</p></div>}
    </section>

    <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="sm:max-w-xl"><SheetHeader><div className="flex items-center gap-2"><Badge variant="outline" className="rounded-full">{selected?.type === "product_request" ? "Product request" : "Message"}</Badge>{selected && <Badge className="rounded-full" variant={selected.status === "new" ? "default" : "secondary"}>{statusLabels[selected.status]}</Badge>}</div><SheetTitle className="pr-8 text-xl">{selected?.subject}</SheetTitle><SheetDescription>Received {selected ? new Date(selected.createdAt).toLocaleString() : ""}</SheetDescription></SheetHeader>{selected && <SheetBody className="space-y-6"><div className="rounded-2xl border bg-muted/20 p-4"><p className="text-sm leading-6 whitespace-pre-wrap">{selected.message}</p></div><Detail label="Customer" value={selected.customerName} /><Detail label="Email" value={selected.customerEmail} href={selected.customerEmail ? `mailto:${selected.customerEmail}` : undefined} /><Detail label="Phone / WhatsApp" value={selected.customerPhone} href={selected.customerPhone ? `tel:${selected.customerPhone}` : undefined} />{Object.entries(selected.details).filter(([, value]) => value).map(([key, value]) => <Detail key={key} label={formatKey(key)} value={value} href={key === "productUrl" ? value : undefined} />)}</SheetBody>}<SheetFooter className="flex-row justify-between"><Button disabled={updating || !selected} onClick={() => selected && void updateStatus(selected.status === "archived" ? "read" : "archived")} size="sm" variant="ghost">{selected?.status === "archived" ? "Restore" : "Archive"}</Button><Button disabled={updating || !selected || selected.status === "resolved"} onClick={() => void updateStatus("resolved")} size="sm">{updating ? "Updating…" : selected?.status === "resolved" ? "Resolved" : "Mark resolved"}</Button></SheetFooter></SheetContent></Sheet>
  </>;
}

async function updateStatusFor(inquiry: StorefrontInquiry, status: StorefrontInquiryStatus, tenantId: string | undefined, router: ReturnType<typeof useRouter>) { const suffix = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""; const response = await fetch(`${dashboardRoutes.inquiryAction(inquiry.id)}${suffix}`, { method: "PATCH", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ status }) }); if (response.ok) router.refresh(); }
function Detail({ label, value, href }: { label: string; value: string | null; href?: string | undefined }) { if (!value) return null; return <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>{href ? <a className="mt-1 block break-all text-sm font-medium text-primary underline-offset-4 hover:underline" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>{value}</a> : <p className="mt-1 break-words text-sm font-medium">{value}</p>}</div>; }
function formatKey(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()); }
function relativeDate(value: string) { const time = new Date(value).getTime(); const diff = Date.now() - time; if (diff < 60_000) return "Now"; if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`; if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`; return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
