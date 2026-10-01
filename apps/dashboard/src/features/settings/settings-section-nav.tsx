"use client";

import { useState } from "react";
import { type AppIcon, AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import {
  groupSettingsSections,
  SETTINGS_SECTION_IDS,
  type SettingsSectionId,
  searchSettingsSections,
} from "./settings-nav";

const SECTION_ICONS: Record<SettingsSectionId, AppIcon> = {
  shop: AppIcons.settings,
  documents: AppIcons.documents,
  preferences: AppIcons.preferences,
  notifications: AppIcons.notifications,
  team: AppIcons.team,
  telegram: AppIcons.smartphone,
  payments: AppIcons.billing,
  fulfillment: AppIcons.orders,
  storefront: AppIcons.editor,
  domains: AppIcons.global,
  account: AppIcons.user,
};

export function SettingsSectionNav({
  active,
  onSelect,
  visibleSections = SETTINGS_SECTION_IDS,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
  visibleSections?: SettingsSectionId[];
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const groups = groupSettingsSections(searchSettingsSections(query, visibleSections, t));
  const ActiveIcon = SECTION_ICONS[active];
  return (
    <nav
      aria-label={t("settings.navAria")}
      className="sticky top-14 z-30 -mx-4 min-w-0 self-stretch border-b border-border/70 bg-background px-4 py-3 sm:top-16 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 lg:top-20 lg:mx-0 lg:w-52 lg:shrink-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0"
    >
      <div className="flex justify-center lg:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full max-w-sm justify-between"
              role="combobox"
              aria-expanded={open}
              aria-label={t("settings.navAria")}
            >
              <span className="flex min-w-0 items-center gap-2">
                <ActiveIcon aria-hidden />
                {t(`settings.sections.${active}.label`)}
              </span>
              <AppIcons.arrowDown aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="center"
            collisionPadding={16}
          >
            <Command
              filter={(value, search) =>
                searchSettingsSections(search, visibleSections, t).includes(
                  value as SettingsSectionId,
                )
                  ? 1
                  : 0
              }
            >
              <CommandInput
                placeholder={t("settings.search.placeholder")}
                aria-label={t("settings.search.placeholder")}
                size="panel"
              />
              <CommandList>
                <CommandEmpty>{t("settings.search.empty")}</CommandEmpty>
                {groupSettingsSections(visibleSections).map((group) => (
                  <CommandGroup key={group.id} heading={t(`settings.groups.${group.id}`)}>
                    {group.sections.map((id) => {
                      const Icon = SECTION_ICONS[id];
                      return (
                        <CommandItem
                          key={id}
                          value={id}
                          onSelect={() => {
                            setOpen(false);
                            onSelect(id);
                          }}
                        >
                          <Icon aria-hidden />
                          <span>{t(`settings.sections.${id}.label`)}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div className="hidden lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col lg:gap-4">
        <InputGroup>
          <InputGroupAddon>
            <AppIcons.search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("settings.search.placeholder")}
            aria-label={t("settings.search.placeholder")}
          />
        </InputGroup>
        <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:max-h-[calc(100dvh-10.5rem)] [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
          <ul className="flex flex-col gap-4 pr-2 pb-4">
            {groups.map((group) => (
              <li key={group.id}>
                <h3 className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground">
                  {t(`settings.groups.${group.id}`)}
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {group.sections.map((id) => {
                    const Icon = SECTION_ICONS[id];
                    return (
                      <li key={id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-current={id === active ? "page" : undefined}
                              data-section={id}
                              onClick={() => onSelect(id)}
                              className={cn(
                                "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                                id === active
                                  ? "bg-primary/10 text-foreground"
                                  : "text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                              )}
                            >
                              <Icon
                                aria-hidden
                                className={cn("size-4 shrink-0", id === active && "text-primary")}
                              />
                              <span>{t(`settings.sections.${id}.label`)}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {t(`settings.sections.${id}.description`)}
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          {!groups.length && (
            <output className="block px-2.5 pb-4 text-sm text-muted-foreground">
              {t("settings.search.empty")}
            </output>
          )}
        </ScrollArea>
      </div>
    </nav>
  );
}
