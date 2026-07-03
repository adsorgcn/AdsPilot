import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getRedirectError,
  getURLFromRedirectError,
} from "next/dist/client/components/redirect";

import getUIStateCookies from "~/lib/server/loaders/utils/get-ui-state-cookies";
import { getUserDataById } from "../queries";

import getSupabaseServerComponentClient from "~/core/supabase/server-component-client";
import requireSession from "~/lib/user/require-session";
import getLogger from "~/core/logger";

import initializeServerI18n from "~/i18n/i18n.server";
import getLanguageCookie from "~/i18n/get-language-cookie";

/**
 * @name loadAppData
 * @description This function is responsible for loading the application data
 * from the server-side, used in the (app) layout. The data is cached for
 * the request lifetime, which allows you to call the same across layouts.
 */
const loadAppData = cache(async () => {
  const logger = getLogger();

  try {
    const client = await getSupabaseServerComponentClient();
    const session = await requireSession(client);

    const user = session.user;
    const userId = user.id;

    // we fetch the user record from the Database
    // which is a separate object from the auth metadata
    const userRecord = await getUserDataById(userId);

    if (!userRecord) {
      logger.error(
        {
          name: "loadAppData",
          userId,
        },
        `User record not found in the database. This should not happen after OAuth callback.`,
      );

      // ❌ 不要重定向到 appHome (会导致循环)
      // return redirect(configuration.paths.appHome);

      // ✅ 重定向到专门的错误页面
      return redirect("/setup-error?reason=user_record_not_found");
    }

    // 移除onboarded检查 - 所有用户直接访问dashboard
    // const isOnboarded = Boolean(userRecord?.onboarded);
    // if (!isOnboarded) {
    //   return redirectToOnboarding();
    // }

    const csrfToken = await getCsrfToken();

    // we initialize the i18n server-side
    const languageCookie = await getLanguageCookie();
    const { language } = await initializeServerI18n(languageCookie);

    return {
      language,
      csrfToken,
      auth: {
        accessToken: session.access_token,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
        },
      },
      user: userRecord,
      ui: getUIStateCookies(),
    };
  } catch (error) {
    // if the error is a redirect error, we simply redirect the user
    // to the destination URL extracted from the error
    if (error instanceof Error && getRedirectError(error as any)) {
      const url = getURLFromRedirectError(error as any);

      return redirect(url);
    }

    // 处理其他类型的错误
    logger.error(
      {
        name: "loadAppData",
        error: JSON.stringify(error),
      },
      `Could not load application data`,
    );

    // ❌ 不要重定向到首页 (可能导致循环)
    // return redirectToHomePage();

    // ✅ 重定向到错误页面，提供清晰的错误信息
    return redirect("/error?code=APP_DATA_LOAD_FAILED");
  }
});

async function getCsrfToken() {
  const headersList = await headers();
  return headersList.get("X-CSRF-Token");
}

export default loadAppData;
