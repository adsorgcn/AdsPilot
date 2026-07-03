import './globals.css';

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import classNames from 'clsx';

import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import { normalizeLocale } from '~/i18n/locales';
import {
  buildAlternateLocaleList,
  buildLocaleAlternates,
  formatOpenGraphLocale,
} from '~/lib/seo/locale-alternates';

import ThemeSetter from '~/components/ThemeSetter';
import Fonts from '~/components/Fonts';
import SkipToContent from '~/components/SkipToContent';
import GlobalHotkeys from '~/components/GlobalHotkeys';
import LiveAnnouncer from '~/components/LiveAnnouncer';
import Providers from './providers';
import { ApiPerformanceDashboard } from '~/components/monitoring/ApiPerformanceDashboard';
import { WebVitals } from '~/components/monitoring/WebVitals';
import AdvancedPageTransition from '~/components/animations/AdvancedPageTransition';

import configuration from '~/configuration';

export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['seo']);
  const locale = normalizeLocale(i18n.language);
  const { canonical, languages } = buildLocaleAlternates('/', locale);
  const openGraphLocale = formatOpenGraphLocale(locale);
  const alternateLocale = buildAlternateLocaleList(locale).map((item) =>
    formatOpenGraphLocale(item),
  );

  const keywords = t('default.keywords')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return {
    metadataBase: new URL(configuration.site.siteUrl!),
    title: t('default.title'),
    description: t('default.description'),
    keywords,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      url: canonical,
      siteName: configuration.site.siteName,
      title: t('default.title'),
      description: t('default.description'),
      locale: openGraphLocale,
      type: 'website',
      alternateLocale,
      images: [
        {
          url: '/assets/images/dashboard.webp',
          width: 1280,
          height: 720,
          alt: t('default.ogImageAlt'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('default.title'),
      description: t('default.description'),
      creator: configuration.site.twitterHandle,
    },
    icons: {
      icon: '/assets/images/favicon/favicon.ico',
      shortcut: '/shortcut-icon.png',
      apple: '/assets/images/favicon/apple-touch-icon.png',
      other: {
        rel: 'apple-touch-icon-precomposed',
        url: '/apple-touch-icon-precomposed.png',
      },
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const className = await getClassName();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <html lang={normalizeLocale(i18n.language)} className={className}>
      <head>
        {/* 预连接到关键域名以减少DNS查询和连接时间 */}
        {supabaseUrl && (
          <>
            <link rel="preconnect" href={supabaseUrl} />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        )}

        {/* Google Fonts预连接 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* 网站验证 */}
        <meta name="verify-yeahpromos" content="be12acf4195e" />
      </head>

      <Fonts />
      <ThemeSetter />

      <body>
        <Providers>
          <SkipToContent />
          <GlobalHotkeys />
          <LiveAnnouncer />
          <ApiPerformanceDashboard />
          <WebVitals />
          <div id="main-content" className="min-h-screen">
            <AdvancedPageTransition type="fade" duration={0.4} enableLoadingIndicator={false}>
              {children}
            </AdvancedPageTransition>
          </div>
        </Providers>
      </body>
    </html>
  );
}

async function getClassName() {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme')?.value;
  const theme = themeCookie ?? configuration.theme;
  const dark = theme === 'dark';

  return classNames({
    dark,
  });
}
