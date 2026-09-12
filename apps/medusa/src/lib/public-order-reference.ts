/**
 * Runtime-neutral counterpart of the shared contract formatter.
 *
 * Medusa's CLI loads discovered application modules through ts-node's CommonJS
 * path. Importing the ESM-only @ecs/contracts source here breaks `medusa exec`
 * before a script can run, so this leaf helper intentionally has no workspace
 * package dependencies. Keep its behavior covered alongside notification payloads.
 */
export function formatPublicOrderReference(
  orderId: string,
  customDisplayId?: string | null,
): string {
  const custom = customDisplayId?.trim();
  if (custom) return custom;
  const suffix = orderId
    .replace(/^order_/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-10)
    .toUpperCase();
  return suffix ? `ORD-${suffix}` : "Order";
}
