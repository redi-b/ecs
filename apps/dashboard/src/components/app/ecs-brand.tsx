import Image from "next/image";
import React from "react";
import {
  ResourceIllustrationScene,
  type ResourceIllustrationKind,
} from "@/components/app/resource-illustration-scenes";
import { cn } from "@/lib/utils";

/** Shared identity with the public ECS site, not a replacement for shop branding. */
export function EcsWordmark({ className }: { className?: string }) {
  return (
    <Image
      alt="ECS"
      className={cn("h-8 w-auto shrink-0 dark:brightness-125", className)}
      height={33}
      src="/brand/logo.svg"
      unoptimized
      width={85}
    />
  );
}

/** Landing artwork is decorative; the adjacent heading explains the state. */
export function EcsArtwork({
  className,
  kind = "empty",
  size = "default",
}: {
  className?: string;
  kind?: "inventory" | "income" | "storefront" | "orders" | "products" | ResourceIllustrationKind;
  size?: "default" | "compact";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-[oklch(0.97_0.012_265)] text-[oklch(0.53_0.2_265)]",
        size === "compact" ? "size-16 rounded-[1.15rem]" : "size-28 rounded-[2rem]",
        className,
      )}
    >
      {kind !== "inventory" && kind !== "income" ? (
        <CommerceScene className={size === "compact" ? "size-14" : "size-24"} kind={kind} />
      ) : (
        <Image
          alt=""
          className={cn("object-contain", size === "compact" ? "size-14" : "size-24")}
          height={104}
          src={`/brand/${kind}-tracking-art.svg`}
          unoptimized
          width={104}
        />
      )}
    </span>
  );
}

/** Original compact scenes echo the landing's blue ink and commerce motifs. */
function CommerceScene({
  className,
  kind,
}: {
  className: string;
  kind: "storefront" | "orders" | "products" | ResourceIllustrationKind;
}) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 104 104">
      <ellipse cx="52" cy="84" rx="34" ry="5" fill="currentColor" opacity="0.08" />
      <path
        d="M12 57a40 40 0 0 1 64-37M92 48a40 40 0 0 1-17 32"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 5"
        opacity="0.2"
      />
      {kind === "storefront" ? (
        <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M25 43h54v38H25z" fill="currentColor" fillOpacity="0.06" />
          <path d="m29 27-8 17h62l-8-17z" fill="currentColor" fillOpacity="0.12" />
          <path d="M21 44v4a6 6 0 0 0 12 0v-4m0 4a6 6 0 0 0 12 0v-4m0 4a7 7 0 0 0 14 0v-4m0 4a6 6 0 0 0 12 0v-4m0 4a6 6 0 0 0 12 0v-4" />
          <path d="m42 27-3 17m13-17v17m10-17 3 17" opacity="0.5" />
          <path d="M34 60h16v12H34zM59 81V60h12v21" />
          <path d="M85 19v8m-4-4h8" strokeLinecap="round" />
        </g>
      ) : kind === "products" ? (
        <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M28 29h40v51H28z" fill="currentColor" fillOpacity="0.06" />
          <path d="M36 39h24v20H36z" fill="currentColor" fillOpacity="0.1" />
          <path d="m36 55 7-8 7 6 4-4 6 6M36 67h17M36 73h10" strokeLinecap="round" opacity="0.6" />
          <circle cx="55" cy="44" r="2" fill="currentColor" stroke="none" />
          <path d="m58 66 10-16h15l7 12-16 21z" fill="oklch(0.97 0.012 265)" />
          <circle cx="77" cy="58" r="2" />
          <path d="M79 18v8m-4-4h8" strokeLinecap="round" />
        </g>
      ) : kind === "orders" ? (
        <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path
            d="M27 22h39v57l-5-4-5 4-5-4-5 4-5-4-5 4-9-5z"
            fill="currentColor"
            fillOpacity="0.06"
          />
          <path d="M36 34h20M36 43h15M36 52h10" strokeLinecap="round" opacity="0.6" />
          <path d="m54 62 17-9 17 9v20l-17 9-17-9z" fill="oklch(0.97 0.012 265)" />
          <path d="m54 62 17 9 17-9M71 71v20M63 57l17 9v8" />
          <path d="M82 24v8m-4-4h8" strokeLinecap="round" />
        </g>
      ) : (
        <ResourceIllustrationScene kind={kind} />
      )}
      <circle cx="17" cy="73" r="2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
