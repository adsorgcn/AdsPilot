import configuration from '~/configuration';
import { InitOptions } from 'i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, normalizeLocale } from '~/i18n/locales';

const fallbackLng = normalizeLocale(configuration.site.locale);
const languages: string[] = [...SUPPORTED_LOCALES];

export const I18N_COOKIE_NAME = 'lang';

/**
 * The default array of Internationalization (i18n) namespaces.
 * These namespaces are commonly used in the application for translation purposes.
 *
 * Add your own namespaces here
 **/
export const defaultI18nNamespaces = [
  'common',
  'auth',
  'profile',
  'settings',
  'navigation',
  'admin',
  'subscription',
  'marketing',
  'contact',
  'seo',
  'styleGuide',
  'setup',
];

function getI18nSettings(
  language: Maybe<string>,
  ns: string | string[] = defaultI18nNamespaces,
): InitOptions {
  let lng = language ?? fallbackLng;

  if (!languages.includes(lng)) {
    console.warn(
      `Language "${lng}" is not supported. Falling back to "${fallbackLng}"`,
    );

    lng = fallbackLng;
  }

  return {
    supportedLngs: languages,
    fallbackLng,
    lng: normalizeLocale(lng),
    fallbackNS: defaultI18nNamespaces,
    defaultNS: defaultI18nNamespaces,
    ns,
  };
}

export default getI18nSettings;
