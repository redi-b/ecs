import { Skeleton } from "@/components/ui/skeleton";

export default function OperationsLoading() {
  return (
    <output aria-label="Loading operations page" aria-live="polite" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b p-3 sm:p-4">
          <Skeleton className="h-8 flex-1 max-w-sm" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="divide-y">
          {["one", "two", "three", "four"].map((id) => (
            <div className="flex items-center gap-4 px-4 py-3.5" key={id}>
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-32 max-w-full" />
              </div>
              <Skeleton className="hidden h-7 w-20 sm:block" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading current operations information…</span>
    </output>
  );
}
