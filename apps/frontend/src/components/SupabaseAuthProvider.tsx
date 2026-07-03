"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import AuthChangeListener from '~/components/AuthChangeListener';
import UserSessionContext from '~/core/session/contexts/user-session';
import type UserSession from '~/core/session/types/user-session';

const ANONYMOUS_FINGERPRINT = 'anonymous-user-session';

type Props = React.PropsWithChildren<{
  session: Maybe<UserSession>;
  whenSignedOut?: string;
  onSessionChange?: (session: Maybe<UserSession>) => void;
}>;

function SupabaseAuthProvider({
  session,
  whenSignedOut,
  onSessionChange,
  children,
}: Props) {
  const [userSession, setUserSession] = useState<Maybe<UserSession>>(session);
  const fingerprint = useMemo(() => getSessionFingerprint(session), [session]);

  useEffect(() => {
    setUserSession(session);
    onSessionChange?.(session);
  }, [fingerprint, onSessionChange, session]);

  const handleSessionChange = useCallback(
    (setAction: React.SetStateAction<Maybe<UserSession>>) => {
      setUserSession((previous) => {
        const nextSession =
          typeof setAction === 'function'
            ? (setAction as (value: Maybe<UserSession>) => Maybe<UserSession>)(
                previous,
              )
            : setAction;

        onSessionChange?.(nextSession);

        return nextSession;
      });
    },
    [onSessionChange],
  );

  return (
    <UserSessionContext.Provider
      value={{
        userSession,
        setUserSession: handleSessionChange,
      }}
    >
      <AuthChangeListener whenSignedOut={whenSignedOut}>
        {children}
      </AuthChangeListener>
    </UserSessionContext.Provider>
  );
}

export default SupabaseAuthProvider;

function getSessionFingerprint(session: Maybe<UserSession>) {
  if (!session?.auth?.user) {
    return ANONYMOUS_FINGERPRINT;
  }

  const user = session.auth.user;
  const userId = user.id ?? 'unknown';
  const accessToken = getAccessTokenFromSession(session);
  const dataHash = session.data ? JSON.stringify(session.data) : '';

  return [userId, accessToken, dataHash].join(':');
}

function getAccessTokenFromSession(session: Maybe<UserSession>) {
  if (!session) {
    return '';
  }

  const auth = session.auth as typeof session.auth & {
    accessToken?: string;
  };

  return auth.accessToken ?? '';
}
