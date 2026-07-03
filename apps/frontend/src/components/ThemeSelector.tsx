'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import classNames from 'clsx';

import {
  BACKGROUND_THEMES,
  DEFAULT_THEME_ID,
  type ThemeMode,
} from '~/lib/themes/backgrounds';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectItem,
  SelectValue,
} from '~/core/ui/Select';
import {
  DARK_THEME_CLASSNAME,
  LIGHT_THEME_CLASSNAME,
  setTheme,
} from '~/core/theming';

const THEME_STORAGE_KEY = 'gm-background-theme';

export function useBackgroundTheme() {
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID);

  const applyMode = useCallback((mode: ThemeMode) => {
    const target =
      mode === 'dark' ? DARK_THEME_CLASSNAME : LIGHT_THEME_CLASSNAME;
    setTheme(target);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const resolved =
      BACKGROUND_THEMES.find((theme) => theme.id === stored) ??
      BACKGROUND_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) ??
      BACKGROUND_THEMES[0];

    if (resolved) {
      setThemeId(resolved.id);
      applyMode(resolved.mode);
      localStorage.setItem(THEME_STORAGE_KEY, resolved.id);
    }
  }, [applyMode]);

  const changeTheme = useCallback((newThemeId: string) => {
    const resolved =
      BACKGROUND_THEMES.find((theme) => theme.id === newThemeId) ??
      BACKGROUND_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) ??
      BACKGROUND_THEMES[0];

    if (!resolved) {
      return;
    }

    setThemeId(resolved.id);
    localStorage.setItem(THEME_STORAGE_KEY, resolved.id);
    applyMode(resolved.mode);

    window.dispatchEvent(
      new CustomEvent('background-theme-change', {
        detail: { themeId: resolved.id },
      }),
    );
  }, [applyMode]);

  return { themeId, changeTheme };
}

interface ThemeSelectorProps {
  className?: string;
}

export default function ThemeSelector({ className }: ThemeSelectorProps) {
  const { themeId, changeTheme } = useBackgroundTheme();

  return (
    <Select value={themeId} onValueChange={changeTheme}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="选择主题" />
      </SelectTrigger>

      <SelectContent>
        {BACKGROUND_THEMES.map((theme) => (
          <SelectItem value={theme.id} key={theme.id}>
            <div className="flex items-center gap-2">
              {theme.name}
              {themeId === theme.id && <Check className="h-4 w-4" />}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface BackgroundWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function BackgroundWrapper({ children, className }: BackgroundWrapperProps) {
  const { themeId } = useBackgroundTheme();
  const [isDark, setIsDark] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState(themeId);

  // Monitor dark mode changes
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Listen for background theme change events
  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ themeId: string }>;
      setCurrentThemeId(customEvent.detail.themeId);
    };

    window.addEventListener('background-theme-change', handleThemeChange);

    return () => {
      window.removeEventListener('background-theme-change', handleThemeChange);
    };
  }, []);

  // Sync initial themeId
  useEffect(() => {
    setCurrentThemeId(themeId);
  }, [themeId]);

  const theme = BACKGROUND_THEMES.find(t => t.id === currentThemeId) || BACKGROUND_THEMES[0];
  const bgStyle = isDark && theme.darkStyle ? theme.darkStyle : theme.style;

  return (
    <div className={classNames('relative min-h-screen', className)}>
      {/* Background Layer */}
      <div
        className="fixed inset-0 -z-10 transition-all duration-500"
        style={bgStyle}
      />

      {/* Content Layer */}
      <div className="relative z-0">
        {children}
      </div>
    </div>
  );
}
