import { cookies } from 'next/headers';

const THEME_COOKIE_NAME = 'theme';

export async function parseThemeCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(THEME_COOKIE_NAME)?.value;
}
