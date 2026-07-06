import { AppIcons } from "@/components/app/icons";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { ListErrorState as ListErrorStateModel } from "@/lib/list-error-state";

export function ListSetupState({ state }: { state: ListErrorStateModel }) {
  if (state.kind === "error") {
    return null;
  }

  return (
    <Empty className="min-h-[22rem] border bg-card/60">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AppIcons.settings />
        </EmptyMedia>
        <EmptyTitle>{state.title}</EmptyTitle>
        <EmptyDescription>{state.description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
