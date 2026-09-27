import { RiLoader4Line as Loader2Icon } from "@remixicon/react";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2Icon>) {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      data-slot="spinner"
      role="status"
      {...props}
    />
  );
}

export { Spinner };
