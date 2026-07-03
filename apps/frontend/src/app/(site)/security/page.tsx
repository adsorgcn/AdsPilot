import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';

type SecuritySection = {
  title: string;
  details: string[];
};

export const metadata = {
  title: 'Security & Compliance - Google-Monetize',
};

export default async function SecurityPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);

  const sections = t('security.sections', {
    returnObjects: true,
  }) as SecuritySection[];

  return (
    <MarketingPageLayout maxWidth="5xl">
      <div className="flex flex-col gap-12">
        <FadeIn>
          <header className="space-y-3 text-center">
            <Heading type={1}>{t('security.hero.title')}</Heading>
            <SubHeading className="text-muted-foreground">
              {t('security.hero.description')}
            </SubHeading>
          </header>
        </FadeIn>

        <FadeInStagger className="space-y-8">
          {sections.map((section) => (
            <FadeInStaggerItem key={section.title}>
              <Card>
                <CardContent className="space-y-3 p-6">
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {section.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" />
                        <span>{detail}</span>
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
