export function SupportAccessBanner({ expiresAt }: { expiresAt: string }) {
  const operationsUrl = process.env.SUPERADMIN_PUBLIC_BASE_URL ?? "http://ops.lvh.me";

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <span>
        <strong>ECS support access is active.</strong> Access ends{" "}
        <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleString()}</time>. Actions remain
        attributed to you.
      </span>
      <a
        className="rounded-sm font-semibold underline underline-offset-4 transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2"
        href={operationsUrl}
      >
        Return to operations
      </a>
    </div>
  );
}
