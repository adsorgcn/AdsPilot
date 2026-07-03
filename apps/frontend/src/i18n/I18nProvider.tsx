'use client';

import type { i18n } from 'i18next';
import isBrowser from '~/core/generic/is-browser';
import { getCookie } from '~/core/generic/cookies';
import { normalizeLocale } from '~/i18n/locales';

let client: i18n;

function I18nProvider({
  lang,
  children,
}: React.PropsWithChildren<{
  lang?: string;
}>) {
  if (!client) {
    throw withI18nClient(lang);
  }

  return children;
}

export default I18nProvider;

async function withI18nClient(lang?: string) {
  const locale = normalizeLocale(lang);

  if (isBrowser()) {
    client = await loadClientI18n(locale);
    return;
  }

  const { default: initialize18n } = await import('~/i18n/i18n.server');
  client = await initialize18n(locale);
}

async function loadClientI18n(lang: Maybe<string>) {
  const language = normalizeLocale(lang ?? getCookie('lang'));
  const { default: initialize18n } = await import('~/i18n/i18n.client');

  return initialize18n(language);
}
