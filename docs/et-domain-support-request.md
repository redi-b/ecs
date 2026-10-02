# Ethio telecom domain and DNS support request

Subject: External nameservers and automated wildcard TLS for a .et domain

Hello,

We are considering registering sooq.et for an ecommerce platform hosted on our own infrastructure. We need the apex domain and wildcard subdomains, including app.sooq.et, api.sooq.et, media.sooq.et, and <merchant>.sooq.et.

Could you please confirm:

1. Can we register the domain with Ethio telecom and replace its authoritative nameservers with the two nameservers assigned by Cloudflare? We want to retain registration with you and use Cloudflare for DNS and proxying. Can we manage this in your portal, or must support update the delegation? Are there extra fees or restrictions?
2. Can the domain point to infrastructure hosted outside Ethio telecom, without purchasing a hosting package?
3. If external nameservers are unavailable, can we manage apex A/AAAA records, wildcard A/CNAME records, TXT records, CAA records, and subdomain NS delegation? Can records beginning with an underscore, such as _acme-challenge.sooq.et, be created?
4. Do you provide a documented DNS record management API or RFC 2136 dynamic DNS with TSIG authentication? We need automated creation and deletion of TXT records for ACME DNS-01 certificate issuance and renewal. If available, please share API documentation, authentication details, token permission scopes, supported ACME clients/providers, rate limits, record TTL limits, and expected propagation times. Can multiple TXT values coexist at the same record name?
5. If no API is available, can we create a permanent CNAME at _acme-challenge.sooq.et pointing to a validation hostname in a DNS zone we control elsewhere, or delegate _acme-challenge.sooq.et via NS records? This would allow our external DNS provider to automate certificate validation.
6. Are DNSSEC and publishing/updating/removing DS records supported if we use external nameservers?

Our public TLS edge is Traefik under Dokploy. If we can use Cloudflare nameservers, we intend to use Cloudflare proxying with an apex-plus-wildcard Origin CA certificate at the origin. Otherwise, we need automated publicly trusted certificates covering both sooq.et and *.sooq.et.

Please also confirm availability of sooq.et, registration and renewal fees, required documents, and the process for requesting nameserver changes.

Thank you.
