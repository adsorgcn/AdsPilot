import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';

type PositionItem = {
  title: string;
  location: string;
  description: string;
};

export const metadata = {
  title: 'Join Us - Google-Monetize',
};

export default async function CareersPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);

  const positions = t('careers.positions', {
    returnObjects: true,
  }) as PositionItem[];

  return (
    <MarketingPageLayout maxWidth="5xl">
      <div className="flex flex-col gap-12">
        <FadeIn>
          <header className="space-y-3 text-center">
            <Heading type={1}>{t('careers.hero.title')}</Heading>
            <SubHeading className="text-muted-foreground">
              {t('careers.hero.description')}
            </SubHeading>
          </header>
        </FadeIn>

        <FadeInStagger className="space-y-6">
          {positions.map((position) => (
            <FadeInStaggerItem key={position.title}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-lg font-semibold">
                      {position.title}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {position.location}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {position.description}
                  </p>
                  <a
                    href="mailto:jobs@autoads.dev"
                    className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
                  >
                    {t('careers.applyCta', { email: 'jobs@autoads.dev' })}
                  </a>
                </CardContent>
              </Card>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </div>
    </MarketingPageLayout>
  );
}
