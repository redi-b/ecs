import Link from "next/link";

import { OperationsDataState } from "@/components/operations-data-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <OperationsDataState className="w-full max-w-xl" description="The page does not exist, or your account cannot open it." title="Page not found" action={<Button asChild>
            <Link href="/">Open ECS Operations</Link>
          </Button>} />
    </main>
  );
}
