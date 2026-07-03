import SiteHeaderSessionProvider from '~/app/(site)/components/SiteHeaderSessionProvider';
import Footer from '~/app/(site)/components/Footer';
import loadUserData from '~/lib/server/loaders/load-user-data';
import I18nProvider from '~/i18n/I18nProvider';
import { BackgroundWrapper } from '~/components/ThemeSelector';

// Force dynamic rendering to avoid build-time execution
export const dynamic = 'force-dynamic';

async function ErrorPageLayout({ children }: React.PropsWithChildren) {
  const { session } = await loadUserData();

  return (
    <I18nProvider>
      <BackgroundWrapper>
        <SiteHeaderSessionProvider data={session} />
        {children}
        <Footer />
      </BackgroundWrapper>
    </I18nProvider>
  );
}

export default ErrorPageLayout;