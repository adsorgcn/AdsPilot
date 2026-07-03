import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';

type SupportSection = {
  title: string;
  items: Array<{ label: string; href: string }>;
};

export const metadata = {
  title: 'Support Center - Google-Monetize',
};

export default async function SupportPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);

  const sections = t('support.sections', {
    returnObjects: true,
  }) as SupportSection[];

  return (
    <MarketingPageLayout maxWidth="5xl">
      <div className="flex flex-col gap-12">
        <FadeIn>
          <header className="space-y-3 text-center">
            <Heading type={1}>{t('support.hero.title')}</Heading>
            <SubHeading className="text-muted-foreground">
              {t('support.hero.description')}
            </SubHeading>
          </header>
        </FadeIn>

        <FadeInStagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {sections.map((section) => (
            <FadeInStaggerItem key={section.title}>
              <Card>
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {section.items.map((item) => (
                      <li key={item.label}>
                        <a
                          href={item.href}
                          className="transition hover:text-foreground"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>

        <FadeIn delay={0.3}>
          <Card className="relative overflow-hidden border-0">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/70" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1),_transparent_70%)]" />
            <CardContent className="relative p-8">
              <div className="space-y-3 text-center">
                <h2 className="text-2xl font-semibold text-primary-foreground">
                  {t('support.cta.title')}
                </h2>
                <p className="text-sm text-primary-foreground/80">
                  {t('support.cta.description')}
                </p>
                <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <a
                    href="/contact"
                    className="inline-flex items-center rounded-full bg-background px-6 py-2 text-sm font-semibold text-foreground hover:bg-background/90 transition"
                  >
                    {t('support.cta.primary')}
                  </a>
                  <a
                    href="mailto:support@autoads.dev"
                    className="inline-flex items-center rounded-full border-2 border-primary-foreground/40 px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10 transition"
                  >
                    {t('support.cta.secondary', {
                      email: 'support@autoads.dev',
                    })}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </MarketingPageLayout>
  );
}
