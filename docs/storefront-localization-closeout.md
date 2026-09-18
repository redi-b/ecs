# Storefront localization closeout

Status: in progress

This document tracks the final localization foundation pass. It is intentionally organized by behavior and ownership so fixes remain reusable when more storefront languages are added.

## Principles

- Locale chooses content and formatting. Unicode script chooses the font face.
- English fallback is a valid, visible state, not an error.
- Shop page copy and catalog resources use one translation overlay foundation.
- Resource sheets can open from any relevant dashboard surface without requiring page navigation.
- Saving a resource translation keeps the workspace open and refreshes readiness in place.
- Preview selection expands and reveals the matching editor control before highlighting it.
- Scroll regions consume wheel input only while they can scroll in that direction.
- Disabled storefront languages remain inspectable, but translation actions clearly explain that customers cannot see them yet.

## A. Correctness regressions

- [x] Make dashboard font fallback script-aware in both dashboard locales.
- [x] Make storefront font fallback script-aware for translated and fallback copy.
- [x] Add regression coverage for mixed Latin and Ethiopic content.
- [x] Expand and reveal collapsed editor sections selected from the preview.
- [x] Standardize editor selection highlight and clear stale highlights.
- [x] Remove redundant variant-combination translations when option values already own the customer-visible labels.
- [x] Apply featured-card localized copy consistently to every carousel slide.
- [x] Remove featured-card fields that are no longer rendered or clearly establish their fallback role.
- [x] Respect disabled storefront-language state in the translation workspace and resource entry points.

## B. Shared resource translation foundation

- [x] Create one controlled translation-sheet host for products, categories, collections, and delivery options.
- [x] Allow sheets to open from the translation workspace without navigating away.
- [x] Keep existing direct resource-page entry points.
- [x] Add product-list context-menu access to product translations.
- [x] Keep sheets open after save and refresh the active resource plus coverage data.
- [x] Normalize queue navigation regardless of whether entry came from queue, coverage, or a resource page.
- [x] Remove stale `from` query state when a sheet closes.
- [x] Add accessible previous and next labels and tooltips.
- [x] Capitalize resource sheet titles consistently.
- [x] Add an in-place localization refresh action with scoped loading state.

## C. Translation workspace UX

- [x] Explain Ready, Using English, and Needs review through one mobile-accessible legend.
- [x] Make Needs review actionable and state why it happened.
- [x] Align queue counts, statuses, fractions, and actions with tabular-number columns.
- [x] Make queue resource groups collapsible while preserving progress summaries.
- [x] Include shop-page fields and catalog resources in the overall readiness summary.
- [x] Make the workspace command bar sticky, compact, and consistent with dashboard controls.
- [x] Match the Jump to a section trigger height to adjacent controls.
- [x] Make previous and next reveal collapsed target sections.
- [x] Prevent nested queue and rich-text regions from trapping trackpad scrolling at their boundaries.

## D. Verification

- [x] Focused unit tests for font contracts and readiness totals.
- [x] Dashboard typecheck.
- [x] Storefront typecheck.
- [x] Platform API typecheck.
- [x] Medusa typecheck.
- [x] Relevant focused test suites.
- [x] Biome checks for the dashboard code and repository diff checks.
- [ ] Manual browser verification by the user. No automated browser run requested.

## Decisions and ownership

- Product options and option values own reusable customer-facing labels such as Size, S, Color, and Sage.
- Variants do not ask merchants to translate generated combinations such as S / Sage. Their translated display name is composed from translated option values.
- Product-level titles, subtitles, descriptions, and materials remain independently translatable.
- The NexaHub featured card uses selected product data for product title, image, price, and link. Merchant-authored featured-section copy is limited to section framing and empty-data fallback where it is actually rendered.
- `Needs attention` means a catalog item is only partly handled. Empty translations use English; complete translations and fields explicitly set to use English are ready.
- Catalog readiness does not claim to detect later English source edits. Medusa translation settings do not provide a reliable place for ECS-only source hashes, so completeness is used instead of a misleading stale state.
