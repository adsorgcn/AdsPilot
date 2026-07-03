import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Divider from '~/core/ui/Divider';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import StructuredDataProvider from '~/components/StructuredDataProvider';
import type { Metadata } from 'next';
import configuration from '~/configuration';

type FeatureBlock = {
  title: string;
  description: string;
  highlights: string[];
};

export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['seo']);
  const baseUrl = configuration.site.siteUrl as string;

  return {
    title: t('features.title'),
    description: t('features.description'),
    keywords: t('features.keywords'),
    authors: [{ name: 'Google-Monetize Team' }],
    creator: 'Google-Monetize',
    publisher: 'Google-Monetize',
    openGraph: {
      type: 'website',
      locale: i18n.language,
      url: `${baseUrl}/features`,
      title: t('features.title'),
      description: t('features.description'),
      siteName: configuration.site.siteName,
      images: [
        {
          url: `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: 'Google-Monetize Features - AI Landing Page Evaluation',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: configuration.site.twitterHandle,
      creator: configuration.site.twitterHandle,
      title: t('features.title'),
      description: t('features.description'),
      images: [`${baseUrl}/twitter-image.jpg`],
    },
    alternates: {
      canonical: `${baseUrl}/features`,
    },
  };
}

export default async function FeaturesPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);
  const tSeo = i18n.getFixedT(null, ['seo']);

  const blocks = t('featuresPage.blocks', {
    returnObjects: true,
  }) as FeatureBlock[];

  const title = tSeo('features.title');
  const description = tSeo('features.description');

  return (
    <StructuredDataProvider
      title={title}
      description={description}
      locale={i18n.language}
    >
      <MarketingPageLayout maxWidth="5xl">
        <div className="flex flex-col gap-12 py-16">
        <FadeIn>
          <header className="space-y-3 text-center">
            <Heading type={1}>{t('featuresPage.hero.title')}</Heading>
            <SubHeading className="text-muted-foreground">
              {t('featuresPage.hero.description')}
            </SubHeading>
          </header>
        </FadeIn>

        <FadeInStagger className="space-y-12">
          {blocks.map((feature) => (
            <FadeInStaggerItem key={feature.title}>
              <Card hoverable>
                <CardContent className="p-8">
                  <h2 className="text-2xl font-semibold">
                    {feature.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                  <Divider className="my-6" />
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {feature.highlights.map((item) => (
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
    </StructuredDataProvider>
  );
}
