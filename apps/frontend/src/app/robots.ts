import type { MetadataRoute } from 'next';
import configuration from '~/configuration';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = configuration.site.siteUrl as string;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/auth/',
          '/api/',
          '/manage/',
          '/dashboard/',
          '/settings/',
          '/checkout/',
          '/subscription/',
          '/profile/',
          '/admin/'
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
      {
        userAgent: 'Claude-Web',
        disallow: '/',
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}