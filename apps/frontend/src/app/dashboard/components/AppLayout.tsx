'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import AppTopbar from '~/app/dashboard/components/AppTopbar';
import Toaster from '~/components/Toaster';
import SentryBrowserWrapper from '~/components/SentryProvider';

import type UserSession from '~/core/session/types/user-session';

import CsrfTokenContext from '~/lib/contexts/csrf';
import I18nProvider from '~/i18n/I18nProvider';

import type loadAppData from '~/lib/server/loaders/load-app-data';
import SupabaseAuthProvider from '~/components/SupabaseAuthProvider';
import MobileBottomNav from '~/components/layout/MobileBottomNav';
import Navbar from '~/components/layout/Navbar';

const AppScopeLayout: React.FCC<{
  data: Awaited<ReturnType<typeof loadAppData>>;
}> = ({ data, children }) => {
  const userSessionContext: UserSession = useMemo(() => {
    return {
      auth: data.auth,
      data: data.user ?? undefined,
      role: undefined,
    };
  }, [data]);

  const [userSession, setUserSession] = useState<Maybe<UserSession>>(
    userSessionContext,
  );

  const updateCurrentUser = useCallback(() => {
    if (userSessionContext.auth) {
      setUserSession(userSessionContext);
    }
  }, [userSessionContext]);

  useEffect(updateCurrentUser, [updateCurrentUser]);

  return (
    <SentryBrowserWrapper>
      <SupabaseAuthProvider
        session={userSession}
        onSessionChange={setUserSession}
        whenSignedOut={'/'}
      >
        <CsrfTokenContext.Provider value={data.csrfToken ?? ''}>
          <I18nProvider lang={data.language}>
            <main>
              <Toaster richColors={false} />
              <Navbar />
              <AppTopbar />

              <div className="mx-auto flex flex-col h-[calc(100vh-8rem)] w-full overflow-y-auto">
                {children}
              </div>

              <MobileBottomNav />
            </main>
          </I18nProvider>
        </CsrfTokenContext.Provider>
      </SupabaseAuthProvider>
    </SentryBrowserWrapper>
  );
};

export default AppScopeLayout;
