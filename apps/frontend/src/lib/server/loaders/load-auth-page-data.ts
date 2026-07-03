import 'server-only';

import { redirect } from 'next/navigation';
import configuration from '~/configuration';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import verifyRequiresMfa from '~/core/session/utils/check-requires-mfa';

/**
 * @name loadAuthPageData
 * @description This function is responsible for loading the authentication
 * layout's data.
 * If the user is logged in and does not require multi-factor
 * authentication, redirect them to the app home page. Otherwise, continue
 * to the authentication pages.
 */
const loadAuthPageData = async () => {
  const languageCookie = await getLanguageCookie();
  const { language } = await initializeServerI18n(languageCookie);
  const client = await getSupabaseServerComponentClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  const requiresMultiFactorAuthentication = await verifyRequiresMfa(client);

  // If the user is logged in and does not require multi-factor authentication,
  // redirect them to the home page.
  if (user && !requiresMultiFactorAuthentication) {
    redirect(configuration.paths.appHome);
  }

  return {
    language,
  };
};

export default loadAuthPageData;
