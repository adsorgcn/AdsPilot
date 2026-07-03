import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';

type ResourceSection = {
  title: string;
  description: string;
  links: Array<{ label: string; href: string }>;
};

export const metadata = {
  title: 'Resources - Google-Monetize',
};

export default async function ResourcesPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);

  const sections = t('resourcesPage.sections', {
    returnObjects: true,
  }) as ResourceSection[];

  return (
    <MarketingPageLayout maxWidth="5xl">
      <div className="flex flex-col gap-16">
        <FadeIn>
          <header className="space-y-3 text-center">
            <Heading type={1}>{t('resourcesPage.hero.title')}</Heading>
            <SubHeading className="text-muted-foreground">
              {t('resourcesPage.hero.description')}
            </SubHeading>
          </header>
        </FadeIn>

        <FadeInStagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {sections.map((section) => (
            <FadeInStaggerItem key={section.title}>
              <Card hoverable className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {section.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>

                  <div className="mt-auto space-y-2 text-sm">
                    {section.links.map((link) => (
                      <div key={link.label}>
                        <a
                          href={link.href}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {link.label}
                        </a>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>

        <FadeIn delay={0.3}>
          <Card className="border-primary/20">
            <CardContent className="bg-primary/10 p-8 text-center">
              <h2 className="text-lg font-semibold text-primary">
                {t('resourcesPage.support.title')}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('resourcesPage.support.description')}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button href="/contact" variant="outline">
                  {t('resourcesPage.support.salesCta')}
                </Button>
                <Button href="mailto:support@autoads.dev" variant="secondary">
                  support@autoads.dev
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </MarketingPageLayout>
  );
}
