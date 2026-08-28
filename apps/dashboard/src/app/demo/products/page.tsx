import { DemoProducts } from "@/features/demo/dashboard-demo-sections";
import { DemoInteractionBoundary } from "@/features/demo/demo-interaction-boundary";
export default function Page() {
  return (
    <DemoInteractionBoundary notice="This preview does not make changes.">
      <DemoProducts />
    </DemoInteractionBoundary>
  );
}
