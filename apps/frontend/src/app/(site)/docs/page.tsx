import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { MarketingPageLayout } from '~/core/ui/PageLayout';

export const metadata = {
  title: 'Documentation - Google-Monetize',
};

async function DocsPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);

  return (
    <MarketingPageLayout maxWidth="5xl">
      <div className={'flex flex-col space-y-12'}>
        <FadeIn>
          <div className={'space-y-4 text-center'}>
            <Heading type={1}>{t('docsPage.hero.title')}</Heading>

            <SubHeading className="text-muted-foreground">
              {t('docsPage.hero.description')}
            </SubHeading>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Card>
            <CardContent className={'p-8 text-sm leading-6 text-muted-foreground'}>
              <p>{t('docsPage.content')}</p>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </MarketingPageLayout>
  );
}

export default DocsPage;
