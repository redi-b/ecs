"use client";

import { RiEditLine } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  POPOVER_MOTION_CLASSNAME,
  storefrontGoogleFontsHref,
  useStorefrontPuck,
} from "@/features/storefront-editor/editor-config";
import { cn } from "@/lib/utils";

import { EditorImageSourceActions } from "./editor-settings";
import { isPreviewImageUrl, type StorefrontPageProps } from "./editor-state";
import { preventPreviewLink, updateStorefrontProp } from "./editor-utils";

export function TemplatePreview({
  props,
  storefrontName,
  templateKey,
}: {
  props: StorefrontPageProps;
  storefrontName: string;
  templateKey: string;
}) {
  if (templateKey === "classic@1") {
    return <ClassicV1StorefrontPreview {...props} storefrontName={storefrontName} />;
  }

  return <UnsupportedTemplatePreview templateKey={templateKey} />;
}

export function UnsupportedTemplatePreview({ templateKey }: { templateKey: string }) {
  return (
    <div className="flex min-h-[32rem] items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-lg border bg-muted/30 p-6">
        <div className="text-sm font-semibold">Preview adapter unavailable</div>
        <p className="mt-2 text-sm text-muted-foreground">
          This storefront template needs an editor preview adapter before it can be edited visually.
        </p>
        <p className="mt-3 font-mono text-xs text-muted-foreground">{templateKey}</p>
      </div>
    </div>
  );
}

function isSectionEnabled(value: boolean | undefined) {
  return value !== false;
}

export function ClassicV1StorefrontPreview(
  props: StorefrontPageProps & { storefrontName?: string },
) {
  // Match live classic storefront: Syne display + Outfit body (always loaded).
  const headingFont = props.headingFont?.trim() || "Syne";
  const bodyFont = props.bodyFont?.trim() || "Outfit";
  const theme = {
    backgroundColor: props.backgroundColor || "#ffffff",
    color: props.foregroundColor || "#111827",
    fontFamily: `"${bodyFont}", Outfit, ui-sans-serif, system-ui, sans-serif`,
  };
  const primaryColor = props.primaryColor || "#0f766e";
  const mutedColor = props.mutedColor || "#f3f4f6";
  const storefrontName = props.storefrontName || "Storefront";
  const displayFace = `"${headingFont}", Syne, ui-sans-serif, system-ui, sans-serif`;

  const showAnnouncement = isSectionEnabled(props.announcementEnabled);
  const showHero = isSectionEnabled(props.heroEnabled);
  const showFeaturedCollection = isSectionEnabled(props.featuredCollectionEnabled);
  const showFeaturedProducts = isSectionEnabled(props.featuredProductsEnabled);
  const showCollectionsStrip = isSectionEnabled(props.collectionsStripEnabled);
  const showTrust = isSectionEnabled(props.trustEnabled);
  const showTestimonials = isSectionEnabled(props.testimonialsEnabled);

  const featuredIds = Array.isArray(props.featuredProductIds) ? props.featuredProductIds : [];
  const featuredCardCount =
    featuredIds.length > 0 ? Math.min(Math.max(featuredIds.length, 1), 4) : 3;
  const featuredCollectionHeading =
    props.featuredCollectionTitle?.trim() ||
    (props.featuredCollectionId ? "Selected collection" : "Featured collection");
  const testimonialsHeading = props.testimonialsTitle?.trim() || "What customers say";

  return (
    <main className="min-h-full bg-background" style={theme}>
      <link href={previewGoogleFontsHref([headingFont, bodyFont])} rel="stylesheet" />
      {showAnnouncement ? (
        <div
          className="px-5 py-2.5 text-center text-sm font-semibold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <span className="mx-auto inline-block max-w-[70ch]">
            <EditableText
              fallback="Now accepting orders online."
              propName="announcementText"
              value={props.announcementText}
            />
          </span>
        </div>
      ) : null}
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-8 py-5">
        <div className="flex items-center gap-3">
          <EditableImage
            fallbackLabel={(storefrontName || "S").slice(0, 1).toUpperCase()}
            placeholder="Logo"
            propName="logoAssetId"
            toneColor={primaryColor}
            value={props.logoAssetId}
            variant="logo"
          />
          <span className="font-bold tracking-tight" style={{ fontFamily: displayFace }}>
            {storefrontName}
          </span>
        </div>
        <nav className="flex items-center gap-5">
          <a
            className="min-w-12 text-sm font-semibold"
            href={props.navigationHref || "/"}
            onClick={preventPreviewLink}
          >
            <EditableText
              fallback="Shop"
              propName="navigationLabel"
              value={props.navigationLabel}
            />
          </a>
          <button className="text-sm font-semibold" onClick={preventPreviewLink} type="button">
            Contact
          </button>
        </nav>
      </header>
      {showHero ? (
        <section className="mx-auto grid min-h-[420px] max-w-5xl items-center gap-12 px-8 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-5">
            <p
              className="text-sm font-extrabold uppercase tracking-normal"
              style={{ color: primaryColor }}
            >
              {storefrontName}
            </p>
            <h1
              className="max-w-3xl whitespace-pre-line text-[clamp(2.75rem,6vw,4.5rem)] font-bold leading-none tracking-tight"
              style={{ fontFamily: displayFace }}
            >
              <EditableText
                fallback="Your shop, online"
                multiline
                propName="heroTitle"
                value={props.heroTitle}
              />
            </h1>
            <p className="max-w-xl text-lg leading-7 opacity-75">
              <EditableText
                fallback="Browse products and place an order in minutes."
                multiline
                propName="heroSubtitle"
                value={props.heroSubtitle}
              />
            </p>
            <a
              className="inline-flex h-11 min-w-[9.5rem] items-center justify-center rounded-full px-6 text-sm font-semibold text-white"
              href={props.primaryCtaHref || "/"}
              onClick={preventPreviewLink}
              style={{ backgroundColor: primaryColor, color: "#ffffff" }}
            >
              <EditableText
                fallback="Shop products"
                propName="primaryCtaLabel"
                value={props.primaryCtaLabel}
              />
            </a>
          </div>
          <EditableImage
            placeholder="Hero image"
            propName="heroImageAssetId"
            toneColor={mutedColor}
            value={props.heroImageAssetId}
            variant="hero"
          />
        </section>
      ) : null}

      {showCollectionsStrip ? (
        <section className="mx-auto max-w-5xl px-8 pb-6 pt-4">
          <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: displayFace }}>
            <EditableText
              fallback="Collections"
              propName="collectionsStripTitle"
              value={props.collectionsStripTitle}
            />
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {["One", "Two", "Three"].map((label) => (
              <span
                className="rounded-full border px-3 py-1.5 text-sm font-medium opacity-80"
                key={label}
              >
                Collection {label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Live shop lists real collections. Preview shows placeholders.
          </p>
        </section>
      ) : null}

      {showFeaturedCollection ? (
        <section className="mx-auto max-w-5xl px-8 pb-8 pt-4">
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: displayFace }}>
            <EditableText
              fallback={featuredCollectionHeading}
              propName="featuredCollectionTitle"
              value={props.featuredCollectionTitle}
            />
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div className="rounded-lg border p-4" key={item}>
                <div className="aspect-square rounded-md" style={{ backgroundColor: mutedColor }} />
                <p className="mt-3 text-sm font-medium">
                  {props.featuredCollectionId ? "Collection product" : "Pick a collection"}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showFeaturedProducts ? (
        <section className="mx-auto max-w-5xl px-8 pb-12 pt-4">
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: displayFace }}>
            <EditableText
              fallback="Featured products"
              propName="productSectionTitle"
              value={props.productSectionTitle}
            />
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {Array.from({ length: featuredCardCount }, (_, index) => (
              <div className="rounded-lg border p-4" key={index}>
                <div className="aspect-square rounded-md" style={{ backgroundColor: mutedColor }} />
                <p className="mt-3 text-sm font-medium">
                  {featuredIds.length > 0
                    ? `Selected product ${index + 1}`
                    : "Newest product"}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {featuredIds.length > 0
              ? `${featuredIds.length} product${featuredIds.length === 1 ? "" : "s"} selected in settings.`
              : "No manual pick — live shop shows newest products."}
          </p>
        </section>
      ) : null}

      {showTestimonials ? (
        <section className="mx-auto max-w-5xl px-8 pb-10 pt-2">
          <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: displayFace }}>
            <EditableText
              fallback={testimonialsHeading}
              propName="testimonialsTitle"
              value={props.testimonialsTitle}
            />
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm opacity-80">
              “Great quality and fast delivery.”
              <div className="mt-2 text-xs text-muted-foreground">— Preview quote</div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4 text-sm opacity-80">
              “Will order again.”
              <div className="mt-2 text-xs text-muted-foreground">— Preview quote</div>
            </div>
          </div>
        </section>
      ) : null}

      {showTrust ? (
        <section className="mx-auto grid max-w-5xl gap-4 px-8 pb-12 sm:grid-cols-3">
          {[
            { title: "Easy checkout", body: "Order online in a few steps on this shop." },
            { title: "Clear options", body: "Pick size and color before you buy." },
            { title: "Shop details", body: "Fulfillment and payment choices appear at checkout." },
          ].map((item) => (
            <div className="rounded-lg border p-4" key={item.title}>
              <div className="text-sm font-semibold">{item.title}</div>
              <p className="mt-1 text-sm opacity-75">{item.body}</p>
            </div>
          ))}
        </section>
      ) : null}

      <footer className="mx-auto flex max-w-5xl justify-between gap-5 border-t px-8 py-8 text-sm">
        <div className="flex flex-col gap-1">
          <strong style={{ fontFamily: displayFace }}>{storefrontName}</strong>
          <EditableText fallback="Phone" propName="footerPhone" value={props.footerPhone} />
          <EditableText
            fallback="Address"
            multiline
            propName="footerAddress"
            value={props.footerAddress}
          />
        </div>
      </footer>
    </main>
  );
}

/** Load Syne/Outfit (and draft theme fonts) for the visual editor twin. */
function previewGoogleFontsHref(names: string[]) {
  return (
    storefrontGoogleFontsHref([...names, "Syne", "Outfit"]) ??
    storefrontGoogleFontsHref(["Syne", "Outfit"])!
  );
}

export function EditableText({
  fallback,
  multiline = false,
  propName,
  value,
}: {
  fallback: string;
  multiline?: boolean;
  propName: keyof StorefrontPageProps;
  value?: string | undefined;
}) {
  const data = useStorefrontPuck((api) => api.appState.data);
  const dispatch = useStorefrontPuck((api) => api.dispatch);
  const displayValue = value?.trim() ? value : fallback;

  function updateValue(nextValue: string) {
    updateStorefrontProp(
      data,
      dispatch,
      propName,
      multiline ? nextValue : nextValue.replace(/\n/g, " "),
    );
  }

  if (multiline) {
    return (
      <span className="group/editable relative -m-1 block cursor-text rounded-md p-1 transition-colors hover:bg-primary/5 focus-within:bg-primary/5 [[data-edit-hints=off]_&]:hover:bg-primary/5">
        <textarea
          aria-label={`Edit ${String(propName)}`}
          className="peer block min-h-[1.5em] w-full cursor-text resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 text-inherit outline-none ring-1 ring-primary/25 transition-shadow hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary/60 [[data-edit-hints=off]_&]:ring-transparent [[data-edit-hints=off]_&]:hover:ring-primary/50"
          onChange={(event) => updateValue(event.currentTarget.value)}
          rows={2}
          value={displayValue}
        />
        <EditableHint />
      </span>
    );
  }

  return (
    <span className="group/editable relative -m-1 inline-flex max-w-full cursor-text rounded-md p-1 transition-colors hover:bg-primary/5 focus-within:bg-primary/5 [[data-edit-hints=off]_&]:hover:bg-primary/5">
      <input
        aria-label={`Edit ${String(propName)}`}
        className="peer inline-block min-w-0 max-w-full cursor-text rounded-sm border-0 bg-transparent p-0 text-inherit outline-none ring-1 ring-primary/25 transition-shadow hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary/60 [[data-edit-hints=off]_&]:ring-transparent [[data-edit-hints=off]_&]:hover:ring-primary/50"
        onChange={(event) => updateValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        style={{ width: `calc(${Math.max(displayValue.length, fallback.length, 4)}ch + 0.75rem)` }}
        value={displayValue}
      />
      <EditableHint />
    </span>
  );
}

export function EditableImage({
  fallbackLabel,
  placeholder,
  propName,
  toneColor,
  value,
  variant,
}: {
  fallbackLabel?: string;
  placeholder: string;
  propName: keyof StorefrontPageProps;
  toneColor: string;
  value?: string | undefined;
  variant: "hero" | "logo";
}) {
  const data = useStorefrontPuck((api) => api.appState.data);
  const dispatch = useStorefrontPuck((api) => api.dispatch);
  const imageUrl = isPreviewImageUrl(value) ? value : "";

  function updateValue(nextValue: string) {
    updateStorefrontProp(data, dispatch, propName, nextValue.trim() ? nextValue : undefined);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Edit ${placeholder}`}
          className={cn(
            "group/editable relative flex cursor-pointer items-center justify-center border bg-background text-sm transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 [[data-edit-hints=off]_&]:ring-transparent [[data-edit-hints=off]_&]:hover:ring-primary/50",
            variant === "logo"
              ? "size-10 rounded-md font-semibold text-white ring-1 ring-primary/25 hover:ring-primary/50"
              : "aspect-[4/3] w-full rounded-lg ring-1 ring-primary/25 hover:ring-primary/50",
          )}
          style={variant === "logo" && !imageUrl ? { backgroundColor: toneColor } : undefined}
          type="button"
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full rounded-[inherit] object-cover" src={imageUrl} />
          ) : variant === "logo" ? (
            fallbackLabel
          ) : (
            <span
              className="flex size-full items-center justify-center rounded-[inherit]"
              style={{ backgroundColor: toneColor }}
            >
              {value || placeholder}
            </span>
          )}
          <EditableHint />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(POPOVER_MOTION_CLASSNAME, "w-80")}>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-medium">{placeholder}</div>
            <div className="text-xs text-muted-foreground">
              Upload a file or choose an image from your media library.
            </div>
          </div>
          <EditorImageSourceActions
            onPicked={(url) => {
              if (url) updateValue(url);
            }}
          />
          {value ? (
            <Button onClick={() => updateValue("")} size="sm" type="button" variant="outline">
              Clear image
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EditableHint() {
  // Isolate type size from parent (hero titles inherit huge clamp sizes).
  return (
    <span
      className="pointer-events-none absolute right-0 top-0 z-20 inline-flex -translate-y-1/2 translate-x-1/4 items-center gap-1 rounded-full border border-border/80 bg-background px-1.5 py-0.5 font-medium text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover/editable:opacity-100 group-focus-within/editable:opacity-100 [[data-edit-hints=off]_&]:hidden"
      style={{
        fontSize: 10,
        lineHeight: 1.2,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontWeight: 500,
        letterSpacing: "0.01em",
      }}
    >
      <RiEditLine aria-hidden className="size-3 shrink-0" style={{ width: 12, height: 12 }} />
      Edit
    </span>
  );
}
