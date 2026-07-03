import SiteHeader from '~/app/(site)/components/SiteHeader';
import type UserSession from '~/core/session/types/user-session';
import SupabaseAuthProvider from '~/components/SupabaseAuthProvider';

function SiteHeaderSessionProvider(
  props: React.PropsWithChildren<{
    data: Maybe<{
      auth: UserSession['auth'];
      data: UserSession['data'];
      role: UserSession['role'];
    }>;
  }>,
) {
  return (
    <SupabaseAuthProvider session={props.data}>
      <SiteHeader />
    </SupabaseAuthProvider>
  );
}

export default SiteHeaderSessionProvider;
