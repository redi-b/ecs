"use client";

import { Landmark } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type BankLogoProps = {
  src?: string | null | undefined;
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "size-5 rounded-md",
  md: "size-6 rounded-md",
  lg: "size-8 rounded-lg",
} as const;

const iconClass = {
  sm: "size-3",
  md: "size-3.5",
  lg: "size-4",
} as const;

/** Bank mark, or a landmark placeholder when the logo is missing/fails. */
export function BankLogo({ src, name, className, size = "md" }: BankLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src?.trim()) && !failed;

  if (!showImage) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center border border-border/70 bg-muted text-muted-foreground",
          sizeClass[size],
          className,
        )}
        title={name}
      >
        <Landmark className={iconClass[size]} strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <img
      alt=""
      className={cn(
        "inline-block shrink-0 object-contain bg-background p-0.5 shadow-sm ring-1 ring-border/60",
        sizeClass[size],
        className,
      )}
      decoding="async"
      loading="lazy"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={src!}
      title={name}
    />
  );
}
