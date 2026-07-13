/**
 * Shared identity-link styling for merchant list tables.
 *
 * Default text, primary on hover — matches products and avoids always-on
 * primary/underline which is noisier in dense tables.
 */
export const listEntityLinkClassName =
  "font-medium text-foreground transition-colors hover:text-primary";

/** Same affordance for buttons that open edit sheets / side panels. */
export const listEntityActionClassName =
  "inline-flex max-w-full text-left font-medium text-foreground transition-colors hover:text-primary";
