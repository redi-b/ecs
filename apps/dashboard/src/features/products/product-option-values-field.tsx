"use client";

import type { ClipboardEvent, KeyboardEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ProductOptionValuesField({
  addControl,
  addLabel,
  children,
  className,
  inputLabel,
  onChange,
  onCommit,
  onPasteMany,
  onRemoveLast,
  placeholder,
  value,
}: {
  addControl?: ReactNode;
  addLabel: string;
  children: ReactNode;
  className?: string;
  inputLabel: string;
  onChange?: (value: string) => void;
  onCommit?: () => void;
  onPasteMany?: (value: string) => void;
  onRemoveLast?: (() => void) | undefined;
  placeholder?: string;
  value?: string;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      onCommit?.();
      return;
    }
    if (event.key === "Backspace" && !value && onRemoveLast) {
      event.preventDefault();
      onRemoveLast();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!/[\n,]/.test(pasted) || !onPasteMany) return;
    event.preventDefault();
    onPasteMany(pasted);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {addControl ? (
        <div>{addControl}</div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            aria-label={inputLabel}
            className="min-w-0 flex-1"
            onBlur={onCommit}
            onChange={(event) => onChange?.(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            value={value ?? ""}
          />
          <Button
            disabled={!value?.trim()}
            onPointerDown={(event) => event.preventDefault()}
            onClick={onCommit}
            size="sm"
            type="button"
            variant="outline"
          >
            {addLabel}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
