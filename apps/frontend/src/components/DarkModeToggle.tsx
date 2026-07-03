'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';

import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import Button from '~/core/ui/Button';
import { BACKGROUND_THEMES } from '~/lib/themes/backgrounds';
import { useBackgroundTheme } from '~/components/ThemeSelector';

const DarkModeToggle = () => {
  const { themeId, changeTheme } = useBackgroundTheme();

  const activeTheme = useMemo(() => {
    return (
      BACKGROUND_THEMES.find((theme) => theme.id === themeId) ??
      BACKGROUND_THEMES[0]
    );
  }, [themeId]);

  const isDark = activeTheme.mode === 'dark';
  const Icon = isDark ? MoonIcon : SunIcon;

  return (
    <Select value={activeTheme.id} onValueChange={changeTheme}>
      <SelectTrigger
        asChild
        className="h-9 w-9 border-0 p-0 focus:ring-0 focus:ring-offset-0"
      >
        <Button
          aria-label={'切换背景主题'}
          variant={'ghost'}
          size={'icon'}
          data-cy={'theme-toggle'}
          className="flex items-center !rounded-full border-transparent bg-transparent transition-shadow hover:shadow-xl dark:border-transparent dark:shadow-primary/50"
        >
          <span hidden>
            <SelectValue />
          </span>

          <Icon className="h-4" />
        </Button>
      </SelectTrigger>

      <SelectContent position="popper" sideOffset={5} className="min-w-[16rem]">
        {BACKGROUND_THEMES.map((theme) => {
          const previewStyle: CSSProperties = {
            ...(theme.darkStyle ?? theme.style),
          };

          return (
            <SelectItem value={theme.id} key={theme.id} className="py-2">
              <div className="flex w-full items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80">
                  {theme.mode === 'dark' ? (
                    <MoonIcon className="h-4 w-4" />
                  ) : (
                    <SunIcon className="h-4 w-4" />
                  )}
                </span>

                <span className="text-sm font-medium text-foreground">
                  {theme.name}
                </span>

                <span
                  className="ml-auto h-8 w-14 flex-shrink-0 rounded-md border border-border/60"
                  style={previewStyle}
                />
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

export default DarkModeToggle;
