'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Toaster from '~/components/Toaster';
import SentryBrowserWrapper from '~/components/SentryProvider';
import type UserSession from '~/core/session/types/user-session';
import CsrfTokenContext from '~/lib/contexts/csrf';
import I18nProvider from '~/i18n/I18nProvider';
import type loadAppData from '~/lib/server/loaders/load-app-data';
import SupabaseAuthProvider from '~/components/SupabaseAuthProvider';
import Navbar from '~/components/layout/Navbar';
import MobileBottomNav from '~/components/layout/MobileBottomNav';
import { RouteTransitionProvider } from '~/core/routing/RouteTransitionManager';
import { prefetchPageSet } from '~/core/routing/DynamicImports';

const AuthenticatedPageLayout: React.FCC<{
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

  // 预取策略：立即预取核心页面
  useEffect(() => {
    prefetchPageSet('immediate');

    // 空闲时预取次要页面
    setTimeout(() => {
      prefetchPageSet('idle');
    }, 3000);
  }, []);

  return (
    <SentryBrowserWrapper>
      <SupabaseAuthProvider
        session={userSession}
        onSessionChange={setUserSession}
        whenSignedOut={'/'}
      >
        <CsrfTokenContext.Provider value={data.csrfToken}>
          <I18nProvider lang={data.language}>
            <RouteTransitionProvider>
              <main className="flex min-h-screen flex-col">
                <Toaster richColors={false} />
                <Navbar />

                <div className="flex-1">
                  {children}
                </div>

                <MobileBottomNav />
              </main>
            </RouteTransitionProvider>
          </I18nProvider>
        </CsrfTokenContext.Provider>
      </SupabaseAuthProvider>
    </SentryBrowserWrapper>
  );
};

export default AuthenticatedPageLayout;
