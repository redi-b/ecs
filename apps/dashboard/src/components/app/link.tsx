"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

export type LinkProps = ComponentProps<typeof NextLink>;

/**
 * App-wide Link: prefetch off by default.
 *
 * Next.js Link prefetches in-viewport routes in production, which is expensive
 * for RSC + cookie-auth dashboards (layout + page data per link). Opt in with
 * prefetch / prefetch="auto" / prefetch={true} when a navigation is worth it.
 */
export function Link({ prefetch = false, ...props }: LinkProps) {
  return <NextLink prefetch={prefetch} {...props} />;
}

export default Link;
