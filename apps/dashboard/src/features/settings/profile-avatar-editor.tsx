"use client";

import { defaultProfileAvatar, type ProfileAvatarPreferences } from "@ecs/contracts";
import { useEffect, useId, useRef, useState } from "react";
import { AvatarDice } from "@/components/app/avatar-dice";
import { AppIcons } from "@/components/app/icons";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const tiltGroup = useId();
  const randomizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const impactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState(5);
  const [prevDiceFace, setPrevDiceFace] = useState(5);

  useEffect(
    () => () => {
      if (randomizeTimer.current) clearTimeout(randomizeTimer.current);
      if (impactTimer.current) clearTimeout(impactTimer.current);
    },
    [],
  );

  function randomize() {
    if (rolling) return;

    const random = new Uint32Array(4);
    crypto.getRandomValues(random);
    const randomEye = (random[0] ?? 0) % profileAvatarEyes.length;
    const selectedEye = profileAvatarEyes.indexOf(value.eyes === "auto" ? "variant01" : value.eyes);
    const eyeIndex =
      value.eyes !== "auto" && randomEye === selectedEye
        ? (randomEye + 1) % profileAvatarEyes.length
        : randomEye;
    const eyes = profileAvatarEyes[eyeIndex] ?? "variant01";
    const angle = angles[(random[1] ?? 0) % angles.length] ?? "straight";
    const colors = Object.keys(profileAvatarColors) as Array<ProfileAvatarPreferences["color"]>;
    const color = colors[(random[2] ?? 0) % colors.length] ?? "blue";
    const rolled = ((random[0] ?? 0) % 6) + 1;
    const nextFace = rolled === diceFace ? (rolled % 6) + 1 : rolled;

    const nextPreferences: ProfileAvatarPreferences = {
      ...value,
      eyes,
      angle,
      color,
      variation: (random[3] ?? 0) % 1_000_000,
    };

    const prefersReducedMotion = window?.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setPrevDiceFace(diceFace);
    setDiceFace(nextFace);

    if (prefersReducedMotion) {
      onChange(nextPreferences);
      return;
    }

    if (randomizeTimer.current) clearTimeout(randomizeTimer.current);
    if (impactTimer.current) clearTimeout(impactTimer.current);

    setRolling(true);

    // Synchronize avatar reveal with the impact moment of the roll (~460ms into the 660ms roll)
    impactTimer.current = setTimeout(() => {
      onChange(nextPreferences);
    }, 460);

    // Conclude roll sequence
    randomizeTimer.current = setTimeout(() => {
      setRolling(false);
    }, 660);
  }

  return (
    <FieldSet disabled={disabled} className="gap-3">
      <FieldLegend className="sr-only">{t("settings.accountSecurity.avatar.title")}</FieldLegend>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/15">
        <div className="flex items-center justify-between gap-2 p-3 sm:gap-4 sm:p-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="block shrink-0 rounded-full">
              <ProfileAvatar
                className="size-16 shadow-sm ring-4 ring-background sm:size-20"
                userId={userId}
                name={name}
                preferences={value}
              />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{t("settings.accountSecurity.avatar.preview")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("settings.accountSecurity.avatar.previewHint")}
              </p>
            </div>
          </div>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("settings.accountSecurity.avatar.randomize")}
                className="size-12 shrink-0 rounded-full p-1 transition-transform hover:scale-105 active:scale-[0.96]"
                variant="ghost"
                size="icon"
                type="button"
                disabled={disabled}
                onClick={randomize}
              >
                <AvatarDice
                  className="size-8"
                  face={diceFace}
                  prevFace={prevDiceFace}
                  rolling={rolling}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("settings.accountSecurity.avatar.randomize")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="grid gap-4 border-t border-border/60 p-3 sm:gap-5 sm:p-4 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t("settings.accountSecurity.avatar.expression")}
            </p>
            <div
              className="grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-1 sm:flex sm:flex-wrap"
              role="radiogroup"
              aria-label={t("settings.accountSecurity.avatar.expression")}
            >
              {(["auto", ...profileAvatarEyes] as const).map((eyes, index) => (
                <label key={eyes} className="relative cursor-pointer justify-self-center">
                  <input
                    className="peer sr-only"
                    type="radio"
                    name={eyeGroup}
                    checked={value.eyes === eyes}
                    disabled={disabled}
                    onChange={() => onChange({ ...value, eyes })}
                  />
                  <span className="relative grid size-11 place-items-center rounded-full border-2 border-transparent transition-[border-color,background-color,transform] duration-150 hover:bg-muted/60 active:scale-[0.96] peer-checked:border-primary peer-checked:bg-primary/8 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:pointer-events-none peer-disabled:opacity-50">
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
              {t("settings.accountSecurity.avatar.tilt")}
            </p>
            <div
              aria-label={t("settings.accountSecurity.avatar.tilt")}
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
            >
              {angles.map((angle) => (
                <label className="cursor-pointer" key={angle}>
                  <input
                    checked={value.angle === angle}
                    className="peer sr-only"
                    disabled={disabled}
                    name={tiltGroup}
                    onChange={() => onChange({ ...value, angle })}
                    type="radio"
                    value={angle}
                  />
                  <span className="flex h-12 items-center justify-center rounded-xl border border-transparent bg-muted/30 transition-[border-color,background-color,transform] duration-150 hover:bg-muted/60 active:scale-[0.96] peer-checked:border-primary peer-checked:bg-primary/8 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:pointer-events-none peer-disabled:opacity-50 sm:h-14">
                    <ProfileAvatar
                      className="size-9 after:border-0"
                      name={name}
                      preferences={{ ...value, angle }}
                      userId={userId}
                    />
                  </span>
                  <span className="sr-only">
                    {t(`settings.accountSecurity.avatar.tilts.${angle}`)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 border-t border-border/60 p-3 sm:p-4">
          <div className="contents">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {t("settings.accountSecurity.avatar.color")}
            </p>
            <div
              className="col-span-2 row-start-2 flex flex-wrap gap-1"
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
            className="col-start-2 row-start-1 justify-self-end"
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
