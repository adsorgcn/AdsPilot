'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe, Languages } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';
import Button from '~/core/ui/Button';
import useRefresh from '~/core/hooks/use-refresh';

interface LanguageSwitcherProps {
  variant?: 'icon' | 'dropdown' | 'radio';
  showFlags?: boolean;
  showNativeNames?: boolean;
  className?: string;
  onChange?: (locale: string) => unknown;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'icon',
  showFlags = true,
  showNativeNames = true,
  className = '',
  onChange,
}) => {
  const { t, i18n } = useTranslation('common');
  const refresh = useRefresh();
  const { language: currentLanguage, options } = i18n;

  const locales = useMemo(() => {
    return (options.supportedLngs as string[]).filter(
      (locale) => locale.toLowerCase() !== 'cimode',
    );
  }, [options.supportedLngs]);

  const [value, setValue] = useState(i18n.language);
  const [isChanging, setIsChanging] = useState(false);

  // Language configuration
  const languageConfig = useMemo(() => {
    return {
      'en': {
        name: 'English',
        nativeName: 'English',
        flag: '🇺🇸',
        rtl: false,
      },
      'zh-CN': {
        name: 'Chinese (Simplified)',
        nativeName: '简体中文',
        flag: '🇨🇳',
        rtl: false,
      },
      // 可以轻松扩展更多语言
      'ja': {
        name: 'Japanese',
        nativeName: '日本語',
        flag: '🇯🇵',
        rtl: false,
      },
      'ko': {
        name: 'Korean',
        nativeName: '한국어',
        flag: '🇰🇷',
        rtl: false,
      },
      'ar': {
        name: 'Arabic',
        nativeName: 'العربية',
        flag: '🇸🇦',
        rtl: true,
      },
    };
  }, []);

  const getLanguageInfo = useCallback((locale: string) => {
    return languageConfig[locale as keyof typeof languageConfig] || {
      name: locale,
      nativeName: locale,
      flag: '🌐',
      rtl: false,
    };
  }, [languageConfig]);

  const getLanguageLabel = useCallback((locale: string) => {
    const info = getLanguageInfo(locale);

    if (showNativeNames) {
      return `${info.flag} ${info.nativeName}`;
    }

    return `${info.flag} ${info.name}`;
  }, [getLanguageInfo, showNativeNames]);

  const languageChanged = useCallback(
    async (locale: string) => {
      if (locale === currentLanguage || isChanging) {
        return;
      }

      setIsChanging(true);
      setValue(locale);

      try {
        if (onChange) {
          onChange(locale);
        }

        // 并行执行语言切换和服务器更新
        await Promise.all([
          i18n.changeLanguage(locale),
          setServerLocale(locale),
        ]);

        // 延迟刷新以确保状态更新
        await new Promise(resolve => setTimeout(resolve, 100));
        await refresh();
      } catch (error) {
        console.error('Language switch failed:', error);
        // Restore original state
        setValue(currentLanguage);
      } finally {
        setIsChanging(false);
      }
    },
    [currentLanguage, i18n, onChange, refresh, isChanging],
  );

  // 同步当前语言状态
  useEffect(() => {
    setValue(currentLanguage);
  }, [currentLanguage]);

  // 渲染图标版本
  if (variant === 'icon') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 ${className}`}
            aria-label={t('languageSwitcher.ariaLabel')}
            disabled={isChanging}
          >
            <Globe className="h-5 w-5" />
            {isChanging && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuRadioGroup value={value} onValueChange={languageChanged}>
              {locales.map((locale) => {
                const info = getLanguageInfo(locale);
                const isActive = locale === currentLanguage;

                return (
                  <DropdownMenuRadioItem
                    key={locale}
                    value={locale}
                    className={`flex items-center gap-2 ${isActive ? 'bg-accent' : ''}`}
                    disabled={isChanging}
                  >
                    {showFlags && <span className="text-base">{info.flag}</span>}
                    <span className="flex-1">
                      {showNativeNames ? info.nativeName : info.name}
                    </span>
                    {isActive && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-xs text-muted-foreground"
              disabled
            >
              {t('languageSwitcher.preferences')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    );
  }

  // 渲染下拉菜单版本
  if (variant === 'dropdown') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={`gap-2 ${className}`}
            disabled={isChanging}
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">
              {getLanguageLabel(currentLanguage)}
            </span>
            <ChevronDown className="h-4 w-4" />
            {isChanging && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-sm font-semibold">
              {t('languageSwitcher.selectLanguage')}
            </div>
            <DropdownMenuSeparator />

            {locales.map((locale) => {
              const info = getLanguageInfo(locale);
              const isActive = locale === currentLanguage;

              return (
                <DropdownMenuItem
                  key={locale}
                  onClick={() => languageChanged(locale)}
                  className={`flex items-center gap-3 ${isActive ? 'bg-accent' : ''}`}
                  disabled={isChanging}
                >
                  <span className="text-lg">{info.flag}</span>
                  <div className="flex-1">
                    <div className="font-medium">{info.nativeName}</div>
                    <div className="text-xs text-muted-foreground">
                      {info.name}
                    </div>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-xs text-muted-foreground justify-center"
              disabled
            >
              {t('languageSwitcher.moreLanguagesComing')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    );
  }

  // 渲染单选按钮组版本
  return (
    <div className={`flex gap-1 ${className}`}>
      {locales.map((locale) => {
        const info = getLanguageInfo(locale);
        const isActive = locale === currentLanguage;

        return (
          <Button
            key={locale}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => languageChanged(locale)}
            disabled={isChanging}
            className="flex items-center gap-2"
          >
            {showFlags && <span>{info.flag}</span>}
            <span className="hidden sm:inline">
              {showNativeNames ? info.nativeName : info.name}
            </span>
            {isChanging && locale === value && (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
          </Button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;

// 服务端语言设置函数
async function setServerLocale(locale: string) {
  try {
    const response = await fetch('/api/i18n/set-locale', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale }),
    });

    if (!response.ok) {
      console.warn('Failed to set server locale:', response.status);
    }
  } catch (error) {
    console.warn('Server locale update failed:', error);
    // Silent failure, doesn't affect user experience
  }
}

// Language switching utility function
export const createLanguageSwitcher = (props: Partial<LanguageSwitcherProps> = {}) => {
  const Component = (defaultProps: Partial<LanguageSwitcherProps> = {}) => (
    <LanguageSwitcher {...props} {...defaultProps} />
  );
  Component.displayName = 'LanguageSwitcher';
  return Component;
};

// 预设的变体组件
export const LanguageIconSwitcher = createLanguageSwitcher({ variant: 'icon' });
export const LanguageDropdownSwitcher = createLanguageSwitcher({ variant: 'dropdown' });
export const LanguageRadioSwitcher = createLanguageSwitcher({ variant: 'radio' });