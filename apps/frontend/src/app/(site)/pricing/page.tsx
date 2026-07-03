import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import PricingTable from '~/components/PricingTable';
import Button from '~/core/ui/Button';
import Divider from '~/core/ui/Divider';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import StructuredDataProvider from '~/components/StructuredDataProvider';
import SeoStructuredData from '~/components/SeoStructuredData';
import type { Metadata } from 'next';
import configuration from '~/configuration';
import { buildFAQStructuredData, buildSoftwareApplicationStructuredData } from '~/lib/structured-data';

type FeatureItem = {
  title: string;
  description: string;
};

type FaqItem = {
  question: string;
  answer: string;
};


export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['seo']);
  const baseUrl = configuration.site.siteUrl as string;

  return {
    title: t('pricing.title'),
    description: t('pricing.description'),
    keywords: t('pricing.keywords'),
    authors: [{ name: 'Google-Monetize Team' }],
    creator: 'Google-Monetize',
    publisher: 'Google-Monetize',
    openGraph: {
      type: 'website',
      locale: i18n.language,
      url: `${baseUrl}/pricing`,
      title: t('pricing.title'),
      description: t('pricing.description'),
      siteName: configuration.site.siteName,
      images: [
        {
          url: `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: 'Google-Monetize Pricing Plans - Choose Your Plan',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: configuration.site.twitterHandle,
      creator: configuration.site.twitterHandle,
      title: t('pricing.title'),
      description: t('pricing.description'),
      images: [`${baseUrl}/twitter-image.jpg`],
    },
    alternates: {
      canonical: `${baseUrl}/pricing`,
    },
  };
}

export default async function PricingPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);
  const tSeo = i18n.getFixedT(null, ['seo']);

  const planFeatures = t('pricing.features.items', {
    returnObjects: true,
  }) as FeatureItem[];

  const faqs = t('pricing.faq.items', {
    returnObjects: true,
  }) as FaqItem[];

  const title = tSeo('pricing.title');
  const description = tSeo('pricing.description');

  // Create FAQ structured data
  const faqStructuredData = buildFAQStructuredData({
    faqs: faqs.slice(0, 5).map(faq => ({
      question: faq.question,
      answer: faq.answer
    }))
  });

  // Create Software Application structured data for pricing
  const softwareStructuredData = buildSoftwareApplicationStructuredData({
    name: 'Google-Monetize',
    description: 'AI-powered landing page evaluation platform for affiliate marketers',
    offers: [
      {
        name: 'Starter Plan',
        price: '$298',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock'
      },
      {
        name: 'Professional Plan',
        price: '$998',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock'
      },
      {
        name: 'Elite Plan',
        price: '$2998',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock'
      }
    ],
    aggregateRating: {
      ratingValue: '4.8',
      reviewCount: '150'
    }
  });

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [faqStructuredData, softwareStructuredData]
  };

  return (
    <StructuredDataProvider
      title={title}
      description={description}
      locale={i18n.language}
    >
      <SeoStructuredData data={structuredData} />
      <MarketingPageLayout maxWidth="5xl">
      <div className="flex flex-col gap-24 py-16">
        <FadeIn>
          <section className="space-y-6 text-center">
            <Heading type={1}>{t('pricing.hero.title')}</Heading>

            <SubHeading className="text-muted-foreground">
              {t('pricing.hero.description')}
            </SubHeading>
          </section>
        </FadeIn>

        <FadeIn delay={0.2}>
          <PricingTable />
        </FadeIn>

        <section className="space-y-8 text-center">
          <FadeIn delay={0.3}>
            <Heading type={2}>{t('pricing.features.title')}</Heading>
            <SubHeading className="text-muted-foreground">
              {t('pricing.features.subtitle')}
            </SubHeading>
          </FadeIn>

          <FadeInStagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {planFeatures.map((feature) => (
              <FadeInStaggerItem key={feature.title}>
                <Card hoverable className="h-full">
                  <CardContent className="flex flex-col gap-3 p-6 text-left">
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </section>

        <FadeIn delay={0.5}>
          <section className="space-y-6">
            <Heading type={2} className="text-center">
              {t('pricing.faq.title')}
            </Heading>
            <Card>
              <CardContent className="space-y-4 p-6">
                {faqs.map((faq, index) => (
                  <div key={faq.question} className="space-y-2">
                    <h3 className="text-base font-semibold">
                      {index + 1}. {faq.question}
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {faq.answer}
                    </p>
                    {index < faqs.length - 1 ? <Divider /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </FadeIn>

        <FadeIn delay={0.6}>
          <Card className="relative overflow-hidden border-0">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/70" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1),_transparent_70%)]" />
            <CardContent className="relative px-8 py-12 text-center">
              <Heading type={2} className="text-primary-foreground">
                {t('pricing.cta.title')}
              </Heading>
              <p className="mt-3 text-sm text-primary-foreground/80">
                {t('pricing.cta.description')}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  className="bg-background text-foreground hover:bg-background/90"
                  href="/auth"
                >
                  {t('pricing.cta.primary')}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                  href="/contact"
                >
                  {t('pricing.cta.secondary')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </MarketingPageLayout>
    </StructuredDataProvider>
  );
}
