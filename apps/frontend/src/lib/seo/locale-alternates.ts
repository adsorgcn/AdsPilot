import configuration from '~/configuration';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '~/i18n/locales';

function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '';
  }

  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function buildLocaleAlternates(pathname: string, currentLocale: string) {
  const base = configuration.site.siteUrl as string;
  const normalized = normalizePath(pathname);

  const languages: Record<string, string> = {};

  SUPPORTED_LOCALES.forEach((locale) => {
    languages[locale] = `/${locale}${normalized}`;
  });

  languages['x-default'] = `/${DEFAULT_LOCALE}${normalized}`;

  const canonical = new URL(
    `${currentLocale}${normalized}`,
    base.endsWith('/') ? base : `${base}/`,
  ).toString();

  return {
    canonical,
    languages,
  };
}

export function buildAlternateLocaleList(currentLocale: string) {
  return SUPPORTED_LOCALES.filter(
    (locale) => locale.toLowerCase() !== currentLocale.toLowerCase(),
  );
}

export function formatOpenGraphLocale(locale: string) {
  const normalized = locale.toLowerCase();

  switch (normalized) {
    case 'en':
      return 'en_US';
    case 'zh-cn':
      return 'zh_CN';
    default:
      return locale.replace('-', '_');
  }
}
