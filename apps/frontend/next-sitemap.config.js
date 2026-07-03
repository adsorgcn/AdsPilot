const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.autoads.dev';

const exclude = ['/dashboard*', '/settings*'];

const supportedLocales = ['en', 'zh-CN'];
const defaultLocale = 'en';

function buildLocalizedPath(locale, path) {
  const normalized = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  exclude,
  transform: async (config, path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    const alternateRefs = supportedLocales.map((locale) => ({
      href: `${siteUrl}${buildLocalizedPath(locale, normalizedPath)}`,
      hreflang: locale.toLowerCase(),
    }));

    alternateRefs.push({
      href: `${siteUrl}${buildLocalizedPath(defaultLocale, normalizedPath)}`,
      hreflang: 'x-default',
    });

    return {
      loc: `${siteUrl}${normalizedPath}`,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
      alternateRefs,
    };
  },
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      {
        userAgent: '*',
        disallow: [
          '/dashboard',
          '/settings',
          '/manage',
          '/api',
        ],
      },
    ],
    additionalSitemaps: [[siteUrl, 'server-sitemap.xml'].join('/')],
  },
};
