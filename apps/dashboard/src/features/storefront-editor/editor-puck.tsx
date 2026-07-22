"use client";

import { classicV1EditorSchema as classicV1EditorManifest } from "@ecs/storefront-templates";
import type { Config } from "@puckeditor/core";
import { FieldLabel as PuckFieldLabel } from "@puckeditor/core";

import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  StorefrontCollectionPicker,
  StorefrontProductsPicker,
} from "./editor-merchandising";
import {
  ClassicV1StorefrontPreview,
  UnsupportedTemplatePreview,
} from "./editor-preview";
import { STOREFRONT_PAGE_COMPONENT, type StorefrontPageProps } from "./editor-state";
import { isHexColor } from "./editor-utils";

export function buildPuckConfig(
  templateKey: string,
  storefrontName: string,
): Config<Record<typeof STOREFRONT_PAGE_COMPONENT, StorefrontPageProps>> {
  return {
    components: {
      [STOREFRONT_PAGE_COMPONENT]: {
        fields: buildPuckFields(),
        render: (props) =>
          templateKey === "classic@1" ? (
            <ClassicV1StorefrontPreview {...props} storefrontName={storefrontName} />
          ) : (
            <UnsupportedTemplatePreview templateKey={templateKey} />
          ),
      },
    },
  };
}

export function buildPuckFields() {
  const fieldEntries = classicV1EditorManifest.sections.flatMap((section) =>
    section.fields.map((field) => [
      field.prop,
      {
        label: field.label,
        type: "custom" as const,
        render: ({ name, onChange, value }: PuckCustomFieldProps) => {
          const helpText = "helpText" in field ? field.helpText : undefined;

          return (
            <VisualEditorField
              {...(helpText ? { helpText } : {})}
              kind={field.kind}
              label={field.label}
              name={name}
              onChange={onChange}
              value={value}
            />
          );
        },
      },
    ]),
  );

  return Object.fromEntries(fieldEntries);
}

export type PuckCustomFieldProps = {
  name: string;
  onChange: (value: unknown) => void;
  value: unknown;
};

export function VisualEditorField({
  helpText,
  kind,
  label,
  name,
  onChange,
  value,
}: {
  helpText?: string;
  kind:
    | "color"
    | "image"
    | "link"
    | "text"
    | "textarea"
    | "boolean"
    | "collection"
    | "products";
  label: string;
  name: string;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  const stringValue = typeof value === "string" ? value : "";

  if (kind === "boolean") {
    const checked = typeof value === "boolean" ? value : value !== false;
    return (
      <FieldGroup>
        <Field>
          <div className="flex items-center justify-between gap-3">
            <PuckFieldLabel label={label} />
            <Switch checked={checked} onCheckedChange={(next) => onChange(next)} />
          </div>
          {helpText ? <FieldDescription>{helpText}</FieldDescription> : null}
        </Field>
      </FieldGroup>
    );
  }

  if (kind === "collection") {
    return (
      <FieldGroup>
        <Field>
          <PuckFieldLabel label={label}>
            <StorefrontCollectionPicker
              onChange={(id) => onChange(id || undefined)}
              value={stringValue}
            />
          </PuckFieldLabel>
          {helpText ? <FieldDescription>{helpText}</FieldDescription> : null}
        </Field>
      </FieldGroup>
    );
  }

  if (kind === "products") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    return <StorefrontProductsPicker onChange={onChange} value={ids} />;
  }

  return (
    <FieldGroup>
      <Field>
        <PuckFieldLabel label={label}>
          {kind === "textarea" ? (
            <Textarea
              name={name}
              onChange={(event) => onChange(event.currentTarget.value)}
              value={stringValue}
            />
          ) : (
            <Input
              name={name}
              onChange={(event) =>
                onChange(
                  kind === "image" && !event.currentTarget.value.trim()
                    ? undefined
                    : event.currentTarget.value,
                )
              }
              type={kind === "color" && isHexColor(stringValue) ? "color" : "text"}
              value={stringValue}
            />
          )}
        </PuckFieldLabel>
        {helpText ? <FieldDescription>{helpText}</FieldDescription> : null}
      </Field>
    </FieldGroup>
  );
}
