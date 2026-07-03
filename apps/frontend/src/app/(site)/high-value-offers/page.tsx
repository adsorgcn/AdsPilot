import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import { normalizeLocale } from '~/i18n/locales';
import {
  buildAlternateLocaleList,
  buildLocaleAlternates,
  formatOpenGraphLocale,
} from '~/lib/seo/locale-alternates';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import StructuredDataProvider from '~/components/StructuredDataProvider';
import SeoStructuredData from '~/components/SeoStructuredData';
import type { Metadata } from 'next';
import { buildServiceStructuredData } from '~/lib/structured-data';

export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['seo']);
  const locale = normalizeLocale(i18n.language);
  const { canonical, languages } = buildLocaleAlternates('/high-value-offers', locale);
  const alternateLocales = buildAlternateLocaleList(locale).map((item) =>
    formatOpenGraphLocale(item),
  );

  return {
    title: t('highValueOffers.title'),
    description: t('highValueOffers.description'),
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      url: canonical,
      title: t('highValueOffers.title'),
      description: t('highValueOffers.description'),
      locale: formatOpenGraphLocale(locale),
      alternateLocale: alternateLocales,
      type: 'website',
    },
  };
}

type OfferItem = {
  offerName: string;
  advertiser: string;
  country: string;
  aiScore: number;
  payout: string;
  highlights: string[];
  reason: string;
};

export default async function HighValueOffersPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);
  const tSeo = i18n.getFixedT(null, ['seo']);

  const offers = t('highValueOffers.items', {
    returnObjects: true,
  }) as OfferItem[];

  const title = tSeo('highValueOffers.title');
  const description = tSeo('highValueOffers.description');

  const structuredData = buildServiceStructuredData({
    name: title,
    description,
  });

  return (
    <StructuredDataProvider
      title={title}
      description={description}
      locale={i18n.language}
    >
      <SeoStructuredData data={structuredData} />
      <MarketingPageLayout maxWidth="6xl">
        <div className="flex flex-col gap-12">
          <FadeIn>
            <header className="space-y-3 text-center">
              <Heading type={1}>{t('highValueOffers.hero.title')}</Heading>
              <SubHeading className="text-muted-foreground">
                {t('highValueOffers.hero.description')}
              </SubHeading>
            </header>
          </FadeIn>

          <FadeInStagger className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <FadeInStaggerItem key={offer.offerName} className="flex">
                <Card hoverable className="flex flex-col w-full">
                  <CardContent className="flex flex-col gap-4 p-6 flex-1">
                    {/* Header with AI Score */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground line-clamp-2">
                          {offer.offerName}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {offer.advertiser}
                        </p>
                      </div>
                      <div className="relative flex flex-col items-center gap-0.5">
                        {/* Circular progress ring */}
                        <div className="relative flex h-16 w-16 items-center justify-center">
                          <svg className="absolute h-16 w-16 -rotate-90 transform">
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              className="text-muted/20"
                            />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke="url(#gradient)"
                              strokeWidth="4"
                              fill="none"
                              strokeDasharray={`${(offer.aiScore / 100) * 176} 176`}
                              strokeLinecap="round"
                              className="transition-all duration-1000"
                            />
                            <defs>
                              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" className="text-primary" stopColor="currentColor" />
                                <stop offset="100%" className="text-primary/60" stopColor="currentColor" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="relative z-10 flex flex-col items-center">
                            <span className="text-2xl font-bold text-foreground leading-none">
                              {offer.aiScore}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground leading-none">
                              AI
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Country & Payout */}
                    <div className="flex items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 font-medium text-foreground">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {offer.country}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 font-bold text-primary">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {offer.payout}
                      </span>
                    </div>

                    {/* Highlights */}
                    <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                      {offer.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    {/* AI Reason */}
                    <div className="mt-auto rounded-lg bg-muted/50 p-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {t('highValueOffers.reasonLabel')}
                        </span>
                        {' '}
                        {offer.reason}
                      </p>
                    </div>
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
