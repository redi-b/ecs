"use client";

import { defaultProfileAvatar, type ProfileAvatarPreferences } from "@ecs/contracts";
import { useId } from "react";
import { AppIcons } from "@/components/app/icons";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/provider";
import { profileAvatarColors, profileAvatarEyes } from "@/lib/profile-avatar";

const angles: ProfileAvatarPreferences["angle"][] = ["left", "straight", "right"];

export function ProfileAvatarEditor({
  userId,
  name,
  value,
  onChange,
  disabled,
}: {
  userId: string;
  name: string;
  value: ProfileAvatarPreferences;
  onChange: (value: ProfileAvatarPreferences) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const colorGroup = useId();
  const eyeGroup = useId();

  function randomize() {
    const random = new Uint32Array(3);
    crypto.getRandomValues(random);
    const randomEye = (random[0] ?? 0) % profileAvatarEyes.length;
    const selectedEye = profileAvatarEyes.indexOf(value.eyes === "auto" ? "variant01" : value.eyes);
    const eyeIndex =
      value.eyes !== "auto" && randomEye === selectedEye
        ? (randomEye + 1) % profileAvatarEyes.length
        : randomEye;
    const eyes = profileAvatarEyes[eyeIndex] ?? "variant01";
    const angle = angles[(random[1] ?? 0) % angles.length] ?? "straight";
    onChange({ ...value, eyes, angle, variation: (random[2] ?? 0) % 1_000_000 });
  }

  return (
    <FieldSet disabled={disabled} className="gap-3">
      <FieldLegend className="sr-only">{t("settings.accountSecurity.avatar.title")}</FieldLegend>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/15">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <ProfileAvatar
              className="size-20 shadow-sm ring-4 ring-background"
              userId={userId}
              name={name}
              preferences={value}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">{t("settings.accountSecurity.avatar.preview")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("settings.accountSecurity.avatar.previewHint")}
              </p>
            </div>
          </div>
          <Button
            className="h-10 w-full sm:h-7 sm:w-auto"
            variant="outline"
            size="sm"
            type="button"
            disabled={disabled}
            onClick={randomize}
          >
            {t("settings.accountSecurity.avatar.randomize")}
          </Button>
        </div>

        <div className="grid gap-5 border-t border-border/60 p-4 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t("settings.accountSecurity.avatar.expression")}
            </p>
            <div
              className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-1"
              role="radiogroup"
              aria-label={t("settings.accountSecurity.avatar.expression")}
            >
              {(["auto", ...profileAvatarEyes] as const).map((eyes, index) => (
                <label key={eyes} className="relative cursor-pointer justify-self-start">
                  <input
                    className="peer sr-only"
                    type="radio"
                    name={eyeGroup}
                    checked={value.eyes === eyes}
                    disabled={disabled}
                    onChange={() => onChange({ ...value, eyes })}
                  />
                  <span className="relative grid size-12 place-items-center rounded-full border-2 border-transparent transition-[border-color,background-color,transform] duration-150 hover:bg-muted/60 active:scale-[0.96] peer-checked:border-primary peer-checked:bg-primary/8 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:pointer-events-none peer-disabled:opacity-50 sm:size-11">
                    <ProfileAvatar
                      className="size-9 after:border-0 sm:size-8"
                      userId={userId}
                      name={name}
                      preferences={{ ...value, eyes, angle: "straight" }}
                    />
                    {eyes === "auto" ? (
                      <span className="absolute right-0 bottom-0 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                        <AppIcons.star className="size-2.5" aria-hidden />
                      </span>
                    ) : null}
                  </span>
                  <span className="sr-only">
                    {eyes === "auto"
                      ? t("settings.accountSecurity.avatar.forYou")
                      : t("settings.accountSecurity.avatar.expressionOption", { number: index })}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="min-w-0 lg:w-56">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t("settings.accountSecurity.avatar.angle")}
            </p>
            <SegmentedControl
              active="muted"
              ariaLabel={t("settings.accountSecurity.avatar.angle")}
              className="h-10 sm:h-8"
              options={angles.map((angle) => ({
                id: angle,
                label: t(`settings.accountSecurity.avatar.angles.${angle}`),
              }))}
              size="sm"
              value={value.angle}
              disabled={disabled}
              onChange={(angle) => onChange({ ...value, angle })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {t("settings.accountSecurity.avatar.color")}
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label={t("settings.accountSecurity.avatar.color")}
            >
              {(Object.keys(profileAvatarColors) as Array<ProfileAvatarPreferences["color"]>).map(
                (color) => (
                  <label key={color} className="relative cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name={colorGroup}
                      value={color}
                      checked={value.color === color}
                      disabled={disabled}
                      onChange={() => onChange({ ...value, color })}
                    />
                    <span className="grid size-11 place-items-center rounded-full border-2 border-transparent transition-[border-color,transform] duration-150 hover:scale-105 active:scale-[0.96] peer-checked:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-50 sm:size-10">
                      <span
                        className="block size-7 rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/10"
                        style={{ backgroundColor: profileAvatarColors[color] }}
                      />
                    </span>
                    <span className="sr-only">
                      {t(`settings.accountSecurity.avatar.colors.${color}`)}
                    </span>
                  </label>
                ),
              )}
            </div>
          </div>
          <Button
            className="h-10 sm:h-7"
            variant="ghost"
            size="sm"
            type="button"
            disabled={disabled || sameAvatar(value, defaultProfileAvatar)}
            onClick={() => onChange({ ...defaultProfileAvatar })}
          >
            {t("settings.accountSecurity.avatar.reset")}
          </Button>
        </div>
      </div>
    </FieldSet>
  );
}

function sameAvatar(a: ProfileAvatarPreferences, b: ProfileAvatarPreferences) {
  return (
    a.color === b.color && a.variation === b.variation && a.eyes === b.eyes && a.angle === b.angle
  );
}
