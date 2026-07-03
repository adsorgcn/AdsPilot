import { SUPPORTED_LOCALES, normalizeLocale } from './locales';

export function stripLocaleFromPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (!firstSegment) {
    return '/';
  }

  const matchedLocale = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === firstSegment.toLowerCase(),
  );

  if (!matchedLocale) {
    return pathname;
  }

  const rest = segments.slice(1).join('/');

  return `/${rest}`.replace(/\/{2,}/g, '/');
}

export function injectLocaleIntoPath(pathname: string, locale: string) {
  const normalizedLocale = normalizeLocale(locale);
  const stripped = stripLocaleFromPath(pathname);

  if (stripped === '/') {
    return `/${normalizedLocale}`;
  }

  return `/${normalizedLocale}${stripped}`.replace(/\/{2,}/g, '/');
}
