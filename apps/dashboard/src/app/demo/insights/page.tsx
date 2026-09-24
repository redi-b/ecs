import { DemoInsights } from "@/features/demo/dashboard-demo-sections";
export default function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  return <DemoInsights report="sales" searchParams={searchParams} />;
}
