'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '~/core/ui/PageLayout';
import NewsletterSignup from './NewsletterSignup';
import configuration from '~/configuration';

const YEAR = new Date().getFullYear();

function Footer() {
  const { t } = useTranslation('common');

  const FOOTER_LINK_GROUPS = [
    {
      title: t('footer.products'),
      links: [
        { label: t('footer.features'), href: '/features' },
        { label: t('footer.highValueOffers'), href: '/high-value-offers' },
        { label: t('footer.pricing'), href: '/pricing' },
      ],
    },
    {
      title: t('footer.resources'),
      links: [
        { label: t('footer.support'), href: '/support' },
        { label: t('footer.updates'), href: '/updates' },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { label: t('footer.about'), href: '/about' },
        { label: t('footer.contact'), href: '/contact' },
      ],
    },
    {
      title: t('footer.security'),
      links: [
        { label: t('footer.privacy'), href: '/privacy' },
        { label: t('footer.terms'), href: '/terms' },
        { label: t('footer.securityDetails'), href: '/security' },
      ],
    },
  ];

  const BOTTOM_LINKS = [
    { label: t('footer.privacy'), href: '/privacy' },
    { label: t('footer.terms'), href: '/terms' },
    { label: t('footer.securityNotice'), href: '/security' },
  ];

  return (
    <footer className="border-t border-border/30 bg-background/60 backdrop-blur-2xl py-16 text-sm text-muted-foreground">
      <PageContainer maxWidth="6xl" padding={false} className="px-5">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[2fr,1fr,1fr,1fr,1fr]">
          {/* 左侧：Logo + 产品介绍 + 订阅模块 */}
          <div className="space-y-6">
            <Image
              src="/assets/images/favicon/logo.png"
              alt={configuration.site.siteName}
              width={1954}
              height={116}
              sizes="(max-width: 768px) 132px, 160px"
              className="h-auto w-32 sm:w-40"
            />
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              {t('footer.description')}
            </p>
            <NewsletterSignup />
          </div>

          {/* 右侧：链接分组 */}
          {FOOTER_LINK_GROUPS.map((group) => (
            <div key={group.title} className="space-y-4">
              <p className="text-base font-semibold text-foreground">
                {group.title}
              </p>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-base transition hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">
              © {YEAR} {configuration.site.siteName}. {t('footer.allRightsReserved')}
            </p>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {BOTTOM_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
    </footer>
  );
}

export default Footer;
