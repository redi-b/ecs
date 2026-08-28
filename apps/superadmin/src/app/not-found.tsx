import { MapPinOff } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <Empty className="w-full max-w-xl rounded-2xl border bg-card py-16 shadow-xs">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapPinOff />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            This address is unavailable or is not part of your operations access.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">Open ECS Operations</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
