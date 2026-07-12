import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { getMerchantCustomer } from "@/lib/merchant-customers";
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const h = await headers();
  const result = await getMerchantCustomer(
    {
      cookieHeader: h.get("cookie"),
      platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
      requestHost: h.get("host"),
    },
    customerId,
  );
  if (!result.ok) notFound();
  const customer = result.customer;
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;
  return (
    <PageShell
      actions={<CustomerFormDialog customer={customer} />}
      description="Customer identity, contact information, groups, and saved addresses."
      title={name}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Contact</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Item label="Email" value={customer.email} />
            <Item label="Phone" value={customer.phone || "Not set"} />
            <Item label="Company" value={customer.companyName || "Not set"} />
            <Item
              label="Customer since"
              value={new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
                new Date(customer.createdAt),
              )}
            />
          </dl>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Groups</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {customer.groups.map((group) => (
              <Badge key={group.id} variant="secondary">
                {group.name.startsWith("Tenant ") ? "Customer" : group.name}
              </Badge>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold">Addresses</h2>
          {customer.addresses.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {customer.addresses.map((address) => (
                <div className="rounded-xl border p-4" key={address.id}>
                  <p className="text-sm font-medium">{address.address1 || "Address"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[address.city, address.countryCode].filter(Boolean).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No saved addresses.</p>
          )}
        </section>
      </div>
    </PageShell>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
