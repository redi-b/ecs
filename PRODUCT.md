# ECS Product

## Register

product

## Users

ECS serves Ethiopian merchants and the people who operate their shops. Many users are not ecommerce or infrastructure specialists. They may work primarily from mobile devices, on constrained connections, and in either English or Amharic. Their job is to launch a credible online shop, manage products and orders, understand business performance, and complete routine operations without learning platform internals.

Platform operators use a separate operational surface to support merchants, diagnose bounded problems, and perform audited administrative actions. They need greater information density and stronger safety context, but should share the same coherent ECS product language.

## Product Purpose

ECS is a hosted, multi-tenant commerce platform for Ethiopian merchants. It removes the need for each merchant to assemble hosting, storefront software, commerce infrastructure, payments, and operational tooling independently. Success means a merchant can confidently run a professional shop while the platform handles the technical machinery reliably and quietly.

## Brand Personality

Calm, practical, trustworthy.

The product speaks with direct professional confidence. It explains what users need to decide or do, using plain language without sounding childish, promotional, or vague. Public documentation may use necessary technical terminology, but defines it clearly and keeps procedures complete.

## Anti-references

- Developer-console language exposed to merchants, including server checks, feature flags, queues, internal identifiers, and implementation explanations.
- SaaS marketing copy inside authenticated workflows.
- Card-heavy dashboards that fragment simple tasks into decorative containers.
- Generic AI-product styling, purple glows, glass surfaces, gradient text, and ornamental motion.
- Dense operator terminology copied unchanged into merchant-facing screens.
- Simplified public documentation that hides prerequisites, risks, failure modes, or important technical terms.

## Design Principles

1. Put the merchant's decision first. Every screen should make the next useful action and its consequences clear.
2. Translate machinery into outcomes. Keep implementation detail in APIs, logs, and engineering documents; present meaningful status and recovery guidance to users.
3. Earn trust through completeness. Use honest states, explicit requirements, durable feedback, and professional documentation instead of optimistic promises.
4. Prefer familiar, efficient workflows. Consistency and standard affordances matter more than novelty in operational software.
5. Separate audiences deliberately. Merchant, public-documentation, and platform-operator language may differ in density, but must describe the same product truth without gaps.

## Accessibility & Inclusion

- Target WCAG 2.2 AA for authenticated product surfaces and public documentation.
- Treat English and Amharic as equal product languages, including validation, loading, empty, error, and recovery states.
- Design mobile-first for merchant workflows while preserving efficient desktop operation.
- Support keyboard navigation, visible focus, adequate touch targets, color-independent status communication, and reduced motion.
- Account for constrained Ethiopian mobile networks through restrained assets, stable layouts, and clear progressive feedback.
