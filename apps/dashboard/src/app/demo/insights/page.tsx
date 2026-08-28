import { DemoInsights } from "@/features/demo/dashboard-demo-sections";
import { DemoInteractionBoundary } from "@/features/demo/demo-interaction-boundary";
export default function Page() {
  return (
    <DemoInteractionBoundary notice="This preview does not make changes.">
      <DemoInsights />
    </DemoInteractionBoundary>
  );
}
