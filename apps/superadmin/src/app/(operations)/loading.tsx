import { Skeleton } from "@/components/ui/skeleton";

export default function OperationsLoading() {
  return (
    <output aria-label="Loading operations page" aria-live="polite" className="space-y-7">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>
      <div className="flex items-center gap-2 border-b pb-3">
        {[
          { id: "overview", width: "w-24" },
          { id: "commerce", width: "w-28" },
          { id: "support", width: "w-20" },
          { id: "controls", width: "w-24" },
        ].map(({ id, width }) => (
          <Skeleton className={`h-8 ${width} rounded-full`} key={id} />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <div className="divide-y">
          {["one", "two", "three", "four", "five"].map((id) => (
            <div className="flex items-center gap-4 p-5" key={id}>
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
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
