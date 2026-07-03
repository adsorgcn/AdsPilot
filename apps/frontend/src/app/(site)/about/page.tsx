import { MarketingPageLayout } from '~/core/ui/PageLayout';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import StructuredDataProvider from '~/components/StructuredDataProvider';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import type { Metadata } from 'next';
import configuration from '~/configuration';
// import { buildOrganizationStructuredData } from '~/lib/structured-data';

type ValueItem = {
  title: string;
  description: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['seo', 'marketing']);
  const baseUrl = configuration.site.siteUrl as string;

  return {
    title: t('about.title', 'About Google-Monetize - AI-Powered Landing Page Evaluation Platform'),
    description: t('about.description', 'Learn about Google-Monetize mission to revolutionize affiliate marketing with AI-powered landing page evaluation. Our team of experts is dedicated to helping marketers achieve 200%-350% ROI improvement.'),
    keywords: t('about.keywords', 'Google-Monetize about, AI landing page evaluation, affiliate marketing team, landing page optimization, Brand Bidding experts, ROI optimization'),
    authors: [{ name: 'Google-Monetize Team' }],
    creator: 'Google-Monetize',
    publisher: 'Google-Monetize',
    openGraph: {
      type: 'website',
      locale: i18n.language,
      url: `${baseUrl}/about`,
      title: t('about.title', 'About Google-Monetize - AI-Powered Landing Page Evaluation Platform'),
      description: t('about.description', 'Learn about Google-Monetize mission to revolutionize affiliate marketing with AI-powered landing page evaluation. Our team of experts is dedicated to helping marketers achieve 200%-350% ROI improvement.'),
      siteName: configuration.site.siteName,
      images: [
        {
          url: `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: t('about.ogImageAlt', 'About Google-Monetize - Our Mission and Values'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: configuration.site.twitterHandle,
      creator: configuration.site.twitterHandle,
      title: t('about.title', 'About Google-Monetize - AI-Powered Landing Page Evaluation Platform'),
      description: t('about.twitterDescription', 'Learn about Google-Monetize mission to revolutionize affiliate marketing with AI-powered landing page evaluation.'),
      images: [`${baseUrl}/twitter-image.jpg`],
    },
    alternates: {
      canonical: `${baseUrl}/about`,
    },
  };
}

export default async function AboutPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);

  const values = t('about.values', { returnObjects: true }) as ValueItem[];

  const title = t('about.title', 'About Google-Monetize - AI-Powered Landing Page Evaluation Platform');
  const description = t('about.description', 'Learn about Google-Monetize mission to revolutionize affiliate marketing with AI-powered landing page evaluation. Our team of experts is dedicated to helping marketers achieve 200%-350% ROI improvement.');

  // const structuredData = buildOrganizationStructuredData({
//   name: 'Google-Monetize',
//   description,
//   locale: i18n.language,
// });

  return (
    <StructuredDataProvider
      title={title}
      description={description}
      locale={i18n.language}
    >
      <MarketingPageLayout maxWidth="5xl">
        <div className="flex flex-col gap-12">
          <FadeIn>
            <header className="space-y-4 text-center">
              <Heading type={1}>{t('about.hero.title')}</Heading>
              <SubHeading className="text-muted-foreground">
                {t('about.hero.subtitle')}
              </SubHeading>
            </header>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Card className="mx-auto w-full max-w-3xl">
              <CardContent className="space-y-6 p-8 text-muted-foreground">
                <p className="leading-7">{t('about.mission.paragraph1')}</p>
                <p className="leading-7">{t('about.mission.paragraph2')}</p>
                <p className="leading-7">{t('about.mission.paragraph3')}</p>
              </CardContent>
            </Card>
          </FadeIn>

          <section className="space-y-8">
            <FadeIn delay={0.3}>
              <Heading type={2} className="text-center">
                {t('about.valuesTitle')}
              </Heading>
            </FadeIn>

            <FadeInStagger className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {values.map((value) => (
                <FadeInStaggerItem key={value.title} className="flex">
                  <Card className="flex flex-col w-full">
                    <CardContent className="flex flex-col gap-3 p-6 flex-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {value.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-6">
                        {value.description}
                      </p>
                    </CardContent>
                  </Card>
                </FadeInStaggerItem>
              ))}
            </FadeInStagger>
          </section>
        </div>
      </MarketingPageLayout>
    </StructuredDataProvider>
  );
}
