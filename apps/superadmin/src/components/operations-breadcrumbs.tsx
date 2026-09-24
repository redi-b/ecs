"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

const labels: Record<string, string> = {
  audit: "Audit",
  health: "Health",
  merchants: "Merchants",
  operators: "Operators",
  plans: "Plans",
  work: "Work",
};

export function OperationsBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const isMerchant = segments[0] === "tenants" && Boolean(segments[1]);

  if (isMerchant) {
    return (
      <>
        <Button asChild className="md:hidden" size="icon-sm" variant="ghost">
          <Link aria-label="Back to merchants" href="/merchants">
            <ArrowLeft />
          </Link>
        </Button>
        <Breadcrumb className="hidden md:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/merchants">Merchants</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Merchant workspace</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </>
    );
  }

  const label = segments.length ? labels[segments[0] ?? ""] : "Overview";
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{label ?? "Operations"}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
