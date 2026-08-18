# ECS Dashboard design system

**Register:** product (merchant ops UI)

## North star

Calm blue operator console for Ethiopian merchants: dense, bilingual, precise. Signature lives in shell, type, and status language, not decoration.

## Color strategy

Restrained. Tinted neutrals (blue hue) + primary accent for actions and selection. Semantic tokens: `--success`, `--warning`, `--info`, `--destructive`.

No glass, mesh gradients, purple AI glows, or side-stripe card accents.

## Radius

- Base: `0.85rem` (ops-premium, not marshmallow)
- Standard single-line inputs, input groups, buttons, chips, badges, and compact action controls are full pills. Consumers must not override the shared primitive radius.
- Textareas, multi-line editors, media thumbnails, menus, cards, choice tiles, and other structural surfaces use the radius scale instead of pills.
- Nested chrome uses concentric rounding: the inner radius is the outer radius minus the inset or padding between their edges. Do not choose nested radii independently.
- Square icon actions are circular. Image thumbnails and canvas editing outlines may follow the geometry of their content.

## Type

- Body/UI: Geist + Noto Sans Ethiopic
- Utilities: `.type-page-title`, `.type-section-title`, `.type-eyebrow`, `.type-meta`
- Fixed rem scale (not fluid marketing sizes)
- Amharic: no negative tracking on titles

## Motion

- `--ease-dashboard: cubic-bezier(0.22, 1, 0.36, 1)`
- 120–280ms; state and feedback only
- Honor `prefers-reduced-motion`

## Shell

- Sidebar: shop mark + name, quieter section labels, stronger active nav
- Header: sticky, light blur, utilities in a grouped control
- PageShell: title ladder + actions + optional eyebrow/meta

## Signature surfaces

- Sign-in / auth shell (expressive, still calm)
- Ops lists stay consistent and dense
- Overview: attention + readiness first, quiet KPI strip, charts secondary
- Detail pages: shared `detail-surface` (hero, section, field grid, activity)

## Empty & loading

- Chart voids: shared `Empty` primitive
- List empty: flat inside table card (entity icon, no nested dashed blob)
- List loading: `DataTable isLoading` → `ListTableSkeleton` (not “Updating…”)

## Out of scope for craft passes

Storefront marketing templates, full Insights product, reinventing tables.
