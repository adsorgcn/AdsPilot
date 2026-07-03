import { cookies } from 'next/headers';
import { I18N_COOKIE_NAME } from '~/i18n/i18n.settings';
import { normalizeLocale } from '~/i18n/locales';

async function getLanguageCookie() {
  const cookieStore = await cookies();
  const value = cookieStore.get(I18N_COOKIE_NAME)?.value;
  return value ? normalizeLocale(value) : undefined;
}

export default getLanguageCookie;
