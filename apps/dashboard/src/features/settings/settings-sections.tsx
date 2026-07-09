"use client";

import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplateTags } from "@/features/settings/settings-helpers";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}


export function SettingsLinkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <a
        className="inline-flex min-w-0 items-center gap-1 font-medium hover:text-primary"
        href={`//${value}`}
        rel="noreferrer"
        target="_blank"
      >
        <span className="truncate">{value}</span>
        <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}


export function StorefrontTemplateOption({
  currentTemplateKey,
  template,
  tenantId,
}: {
  currentTemplateKey: string | null;
  template: StorefrontTemplateCatalogItem;
  tenantId: string;
}) {
  const selected = currentTemplateKey === template.version.templateKey;
  const tags = getTemplateTags(template);

  return (
    <form
      action={dashboardRoutes.storefrontTemplate}
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-background p-3",
        selected ? "border-primary" : "border-border",
      )}
      method="post"
    >
      <input name="tenantId" type="hidden" value={tenantId} />
      <input name="templateKey" type="hidden" value={template.version.templateKey} />
      <input name="returnTo" type="hidden" value={`${dashboardRoutes.settings}?tab=storefront`} />
      <StorefrontTemplatePreview template={template} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{template.name}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
          </div>
          {selected ? <Badge variant="secondary">Selected</Badge> : null}
        </div>
        {tags.length ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <Button disabled={selected} type="submit" variant={selected ? "secondary" : "default"}>
        {selected ? "Selected" : "Use this storefront"}
      </Button>
    </form>
  );
}


export function StorefrontTemplatePreview({ template }: { template: StorefrontTemplateCatalogItem }) {
  return (
    <div className="aspect-[16/9] overflow-hidden rounded-md border bg-muted">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b bg-background/80 px-3 py-2">
          <span className="h-2 w-16 rounded-full bg-primary" />
          <span className="h-2 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="grid flex-1 grid-cols-[1fr_0.75fr] gap-3 p-3">
          <div className="flex flex-col justify-center gap-2">
            <span className="h-3 w-3/4 rounded-full bg-foreground/80" />
            <span className="h-2 w-full rounded-full bg-muted-foreground/30" />
            <span className="h-2 w-2/3 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="rounded-md bg-primary/20" />
        </div>
      </div>
      <span className="sr-only">{template.name} preview</span>
    </div>
  );
}

