import 'server-only';

import { userApiService } from '~/lib/api/services/UserApiService';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';

/**
 * @name loadUserData
 * @description Loads the user's data from Supabase Auth and Backend API.
 * This is used in the (site) layout to display the user's name and avatar.
 */
async function loadUserData() {
  const client = await getSupabaseServerComponentClient();

  try {
    const { data, error } = await client.auth.getUser();

    if (!data.user || error) {
      return emptyUserData();
    }

    const user = data.user;
    const userId = user.id;

    // Get user profile from Backend API instead of Supabase
    let userData = null;
    try {
      userData = await userApiService.getUserProfile(userId);
    } catch (profileError) {
      console.warn('Failed to load user profile from API:', profileError);
      // Continue with null userData - user will still be authenticated
    }
    const language = await getLanguage();

    return {
      session: {
        auth: {
          user: {
            id: userId,
            email: user.email,
            phone: user.phone,
          },
        },
        data: userData || undefined,
        role: undefined,
      },
      language,
    };
  } catch (e) {
    return emptyUserData();
  }
}

async function emptyUserData() {
  const language = await getLanguage();

  return {
    accessToken: undefined,
    language,
    session: undefined,
  };
}

export default loadUserData;

async function getLanguage() {
  const languageCookie = await getLanguageCookie();
  const { language } = await initializeServerI18n(languageCookie);

  return language;
}
