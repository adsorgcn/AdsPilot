import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import SeoStructuredData from '~/components/SeoStructuredData';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import StructuredDataProvider from '~/components/StructuredDataProvider';
import type { Metadata } from 'next';
import configuration from '~/configuration';

import LandingPageClient from './LandingPageClient';

export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['seo']);
  const baseUrl = configuration.site.siteUrl as string;

  return {
    title: t('default.title'),
    description: t('default.description'),
    keywords: t('default.keywords'),
    authors: [{ name: 'Google-Monetize Team' }],
    creator: 'Google-Monetize',
    publisher: 'Google-Monetize',
    openGraph: {
      type: 'website',
      locale: i18n.language,
      url: baseUrl,
      title: t('default.title'),
      description: t('default.description'),
      siteName: configuration.site.siteName,
      images: [
        {
          url: `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: t('default.ogImageAlt'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: configuration.site.twitterHandle,
      creator: configuration.site.twitterHandle,
      title: t('default.title'),
      description: t('default.description'),
      images: [`${baseUrl}/twitter-image.jpg`],
    },
    alternates: {
      canonical: baseUrl,
    },
  };
}

export default async function HomePage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const tSeo = i18n.getFixedT(null, ['seo']);

  const title = tSeo('default.title');
  const description = tSeo('default.description');

  const structuredData = buildStructuredData({
    title,
    description,
    locale: i18n.language,
  });

  return (
    <StructuredDataProvider
      title={title}
      description={description}
      locale={i18n.language}
    >
      <MarketingPageLayout maxWidth="7xl">
        <SeoStructuredData data={structuredData} />
        <LandingPageClient />
      </MarketingPageLayout>
    </StructuredDataProvider>
  );
}

function buildStructuredData({
  title,
  description,
  locale,
}: {
  title: string;
  description: string;
  locale: string;
}) {
  const siteUrl = configuration.site.siteUrl as string;
  const normalizedSiteUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  const twitterHandle = configuration.site.twitterHandle?.replace('@', '') ?? '';

  const sameAs = [] as string[];

  if (twitterHandle) {
    sameAs.push(`https://twitter.com/${twitterHandle}`);
  }

  if (configuration.site.githubHandle) {
    sameAs.push(`https://github.com/${configuration.site.githubHandle}`);
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${normalizedSiteUrl}#website`,
        url: normalizedSiteUrl,
        name: title,
        description,
        inLanguage: locale,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${normalizedSiteUrl}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${normalizedSiteUrl}#organization`,
        name: configuration.site.siteName,
        url: normalizedSiteUrl,
        logo: `${normalizedSiteUrl}/assets/images/favicon/android-chrome-512x512.png`,
        sameAs: sameAs.length > 0 ? sameAs : undefined,
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'support@autoads.dev',
          contactType: 'customer support',
          availableLanguage: ['en', 'zh-CN'],
        },
      },
    ],
  };
}
