import Footer from '~/app/(site)/components/Footer';
import I18nProvider from '~/i18n/I18nProvider';
import SiteHeaderSessionProvider from '~/app/(site)/components/SiteHeaderSessionProvider';
import loadUserData from '~/lib/server/loaders/load-user-data';
import { BackgroundWrapper } from '~/components/ThemeSelector';

async function SiteLayout(props: React.PropsWithChildren) {
  const { session, language } = await loadUserData();

  return (
    <I18nProvider lang={language}>
      <BackgroundWrapper>
        <SiteHeaderSessionProvider data={session} />

        {props.children}

        <Footer />
      </BackgroundWrapper>
    </I18nProvider>
  );
}

export default SiteLayout;
