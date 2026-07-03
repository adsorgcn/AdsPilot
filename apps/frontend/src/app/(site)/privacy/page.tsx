import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';

type PrivacySection = {
  title: string;
  content: string[];
};

export const metadata = {
  title: 'Privacy Policy - Google-Monetize',
};

export default async function PrivacyPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);

  const sections = t('privacyPage.sections', {
    returnObjects: true,
  }) as PrivacySection[];

  return (
    <MarketingPageLayout maxWidth="5xl">
      <div className="flex flex-col gap-12">
        <FadeIn>
          <header className="space-y-3 text-center">
            <Heading type={1}>{t('privacyPage.hero.title')}</Heading>
            <SubHeading className="text-muted-foreground">
              {t('privacyPage.hero.description')}
            </SubHeading>
          </header>
        </FadeIn>

        <FadeInStagger className="space-y-6">
          {sections.map((section) => (
            <FadeInStaggerItem key={section.title}>
              <Card>
                <CardContent className="space-y-3 p-6">
                  <h2 className="text-lg font-semibold">
                    {section.title}
                  </h2>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {section.content.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </div>
    </MarketingPageLayout>
  );
}
