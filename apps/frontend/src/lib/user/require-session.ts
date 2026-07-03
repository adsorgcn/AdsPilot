import { cache } from 'react';
import { redirect } from 'next/navigation';
import verifyRequiresMfa from '~/core/session/utils/check-requires-mfa';
import configuration from '~/configuration';
import type { SupabaseClientInstance } from '~/database.types';
import getLogger from '~/core/logger';

/**
 * @name requireSession
 * @description Require a session to be present in the request
 * @param client
 * @param verifyFromServer
 */
const requireSession = cache(
  async (client: SupabaseClientInstance, verifyFromServer = true) => {
    const { data, error } = await client.auth.getSession();

    if (!data.session || error) {
      return redirectToSignIn(error);
    }

    const requiresMfa = await verifyRequiresMfa(client);

    // If the user requires multi-factor authentication,
    // redirect them to the page where they can verify their identity.
    if (requiresMfa) {
      redirect(configuration.paths.signInMfa);
    }

    if (verifyFromServer) {
      const { data: user, error } = await client.auth.getUser();

      if (!user || error) {
        redirectToSignIn(error, data.session?.user.id);
      }
    }

    return data.session;
  },
);

export default requireSession;

function redirectToSignIn(error: unknown, userId: Maybe<string> = undefined) {
  getLogger().info(
    { error, userId },
    `No session found. Redirecting to sign in page...`,
  );

  return redirect(configuration.paths.signIn);
}
