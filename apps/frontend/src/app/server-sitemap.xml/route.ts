import { getServerSideSitemap } from 'next-sitemap';
import configuration from '~/configuration';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '~/i18n/locales';

const siteUrl = configuration.site.siteUrl as string;

if (!siteUrl) {
  throw new Error(`Invalid "siteUrl", please fix in configuration.ts`);
}

export async function GET() {
  const urls = getSiteUrls();
  return getServerSideSitemap(urls);
}

function getSiteUrls() {
  const basePaths = ['/', '/faq', '/pricing'];
  const now = new Date().toISOString();

  return basePaths.flatMap((path) => {
    const normalizedPath = path === '/' ? '' : path;

    const alternateRefs = SUPPORTED_LOCALES.map((locale) => ({
      href: new URL(`/${locale}${normalizedPath}`, siteUrl).href,
      hreflang: locale.toLowerCase(),
    }));

    alternateRefs.push({
      href: new URL(`/${DEFAULT_LOCALE}${normalizedPath}`, siteUrl).href,
      hreflang: 'x-default',
    });

    return SUPPORTED_LOCALES.map((locale) => ({
      loc: new URL(`/${locale}${normalizedPath}`, siteUrl).href,
      lastmod: now,
      alternateRefs,
    }));
  });
}
