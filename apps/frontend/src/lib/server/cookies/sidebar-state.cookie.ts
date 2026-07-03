import { cookies } from 'next/headers';

const SIDEBAR_STATE_COOKIE_NAME = 'sidebarState';

export async function parseSidebarStateCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SIDEBAR_STATE_COOKIE_NAME)?.value;
}
