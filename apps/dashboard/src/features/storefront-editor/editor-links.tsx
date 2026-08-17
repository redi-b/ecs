"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StorefrontEditorLink = {
  label: string;
  href: string;
};

export function StorefrontLinksEditor({
  path,
  label,
  onChange,
  value,
}: {
  label: string;
  path?: string;
  onChange: (value: StorefrontEditorLink[]) => void;
  value: unknown;
}) {
  const links = normalizeLinks(value);

  const update = (index: number, patch: Partial<StorefrontEditorLink>) => {
    onChange(links.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {links.map((item, index) => (
        <div className="rounded-xl border bg-background p-3" data-editor-settings-path={path ? `${path}.${index}` : undefined} key={index}>
          <div className="grid min-w-0 gap-3">
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
              Label
              <Input
                aria-label={`${label} ${index + 1} label`}
                data-editor-settings-path={path ? `${path}.${index}.label` : undefined}
                onChange={(event) => update(index, { label: event.currentTarget.value })}
                value={item.label}
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
              Link
              <Input
                aria-label={`${label} ${index + 1} link`}
                data-editor-settings-path={path ? `${path}.${index}.href` : undefined}
                onChange={(event) => update(index, { href: event.currentTarget.value })}
                placeholder="/"
                value={item.href}
              />
            </label>
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              onClick={() => onChange(links.filter((_, itemIndex) => itemIndex !== index))}
              size="sm"
              type="button"
              variant="ghost"
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
      <Button
        className="self-start"
        onClick={() => onChange([...links, { label: "", href: "/" }])}
        size="sm"
        type="button"
        variant="outline"
      >
        Add link
      </Button>
    </div>
  );
}

function normalizeLinks(value: unknown): StorefrontEditorLink[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const candidate = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      label: typeof candidate.label === "string" ? candidate.label : "",
      href: typeof candidate.href === "string" ? candidate.href : "",
    };
  });
}
