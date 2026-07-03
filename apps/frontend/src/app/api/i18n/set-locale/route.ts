import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { I18N_COOKIE_NAME } from '~/i18n/i18n.settings';
import { DEFAULT_LOCALE, isSupportedLocale, normalizeLocale } from '~/i18n/locales';

export async function POST(request: Request) {
  const { locale } = await parseRequest(request);
  const normalizedLocale = normalizeLocale(locale);

  const response = NextResponse.json({ success: true, locale: normalizedLocale });
  response.cookies.set(I18N_COOKIE_NAME, normalizedLocale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

async function parseRequest(request: Request) {
  try {
    const body = await request.json();
    const locale = typeof body?.locale === 'string' ? body.locale : undefined;

    if (!locale || !isSupportedLocale(locale)) {
      return { locale: await resolveFallbackLocale() };
    }

    return { locale };
  } catch (error) {
    return { locale: await resolveFallbackLocale() };
  }
}

async function resolveFallbackLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(I18N_COOKIE_NAME)?.value;

  if (cookieLocale && isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  return DEFAULT_LOCALE;
}
