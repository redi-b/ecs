import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CustomerAddressDeleteButton,
  CustomerAddressDialog,
} from "@/features/customers/customer-address-dialog";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { getTranslations } from "@/i18n/server";
import { getMerchantCustomer } from "@/lib/merchant-customers";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const t = await getTranslations();
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
  const notSet = t("common.notSet");

  return (
    <PageShell
      actions={<CustomerFormDialog customer={customer} />}
      description={t("customers.detail.shellDescription")}
      title={name}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">{t("customers.detail.contact")}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Item label={t("customers.detail.email")} value={customer.email} />
            <Item label={t("customers.detail.phone")} value={customer.phone || notSet} />
            <Item label={t("customers.detail.company")} value={customer.companyName || notSet} />
            <Item
              label={t("customers.detail.customerSince")}
              value={new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
                new Date(customer.createdAt),
              )}
            />
          </dl>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">{t("customers.detail.groups")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {customer.groups.length ? (
              customer.groups.map((group) => (
                <Badge key={group.id} variant="secondary">
                  {group.name.startsWith("Tenant ") || group.name.startsWith("Shop ")
                    ? t("customers.table.groupCustomer")
                    : group.name}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t("customers.table.noGroups")}</p>
            )}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{t("customers.detail.addresses")}</h2>
              {customer.addresses.length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {customer.addresses.length === 1
                    ? t("customers.addresses.savedCountOne")
                    : t("customers.addresses.savedCount", { count: customer.addresses.length })}
                </p>
              ) : null}
            </div>
            <CustomerAddressDialog customerId={customer.id} />
          </div>
          {customer.addresses.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {customer.addresses.map((address) => {
                const line = [
                  address.address1,
                  address.address2,
                  address.city,
                  address.province,
                  address.postalCode,
                  address.countryCode?.toUpperCase(),
                ]
                  .filter(Boolean)
                  .join(", ");
                const contact = [address.firstName, address.lastName].filter(Boolean).join(" ");
                return (
                  <div className="flex flex-col gap-3 rounded-xl border p-4" key={address.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {address.addressName ||
                            address.address1 ||
                            t("customers.detail.defaultAddressName")}
                        </p>
                        {contact ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{contact}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {address.isDefaultShipping ? (
                          <Badge variant="secondary">{t("customers.addresses.defaultShipping")}</Badge>
                        ) : null}
                        {address.isDefaultBilling ? (
                          <Badge variant="outline">{t("customers.addresses.defaultBilling")}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {line || t("customers.addresses.noDetails")}
                    </p>
                    {address.phone ? (
                      <p className="text-xs text-muted-foreground">{address.phone}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <CustomerAddressDialog
                        address={address}
                        customerId={customer.id}
                        trigger={
                          <Button size="sm" type="button" variant="outline">
                            {t("customers.addresses.edit")}
                          </Button>
                        }
                      />
                      <CustomerAddressDeleteButton
                        addressId={address.id}
                        customerId={customer.id}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t("customers.addresses.empty")}</p>
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
