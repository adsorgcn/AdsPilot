export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export function isSupportedLocale(locale: string | null | undefined): locale is SupportedLocale {
  if (!locale) {
    return false;
  }

  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  const lower = locale.toLowerCase();

  const match = SUPPORTED_LOCALES.find((supported) => {
    return supported.toLowerCase() === lower;
  });

  return match ?? DEFAULT_LOCALE;
}
