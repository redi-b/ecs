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
            {customer.groups.length ? (
              customer.groups.map((group) => (
                <Badge key={group.id} variant="secondary">
                  {group.name.startsWith("Tenant ") ? "Customer" : group.name}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No groups assigned.</p>
            )}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Addresses</h2>
            {customer.addresses.length ? (
              <p className="text-xs text-muted-foreground">
                {customer.addresses.length} saved address
                {customer.addresses.length === 1 ? "" : "es"}
              </p>
            ) : null}
          </div>
          {customer.addresses.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {customer.addresses.map((address) => {
                const location = [address.city, address.countryCode?.toUpperCase()]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <div className="flex flex-col gap-3 rounded-xl border p-4" key={address.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium">{address.address1 || "Address"}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {address.isDefaultShipping ? (
                          <Badge variant="secondary">Default shipping</Badge>
                        ) : null}
                        {address.isDefaultBilling ? (
                          <Badge variant="outline">Default billing</Badge>
                        ) : null}
                      </div>
                    </div>
                    {location ? (
                      <p className="text-sm text-muted-foreground">{location}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No city or country on file.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No saved addresses. Addresses appear here after checkout or storefront account updates.
            </p>
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
