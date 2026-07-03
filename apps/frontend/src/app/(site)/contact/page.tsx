import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import StructuredDataProvider from '~/components/StructuredDataProvider';
import SeoStructuredData from '~/components/SeoStructuredData';

import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import { normalizeLocale } from '~/i18n/locales';
import {
  buildAlternateLocaleList,
  buildLocaleAlternates,
  formatOpenGraphLocale,
} from '~/lib/seo/locale-alternates';
import { buildOrganizationStructuredData } from '~/lib/structured-data';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['seo']);
  const locale = normalizeLocale(i18n.language);
  const { canonical, languages } = buildLocaleAlternates('/contact', locale);
  const alternateLocales = buildAlternateLocaleList(locale).map((item) =>
    formatOpenGraphLocale(item),
  );

  return {
    title: t('contact.title'),
    description: t('contact.description'),
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      url: canonical,
      title: t('contact.title'),
      description: t('contact.description'),
      locale: formatOpenGraphLocale(locale),
      alternateLocale: alternateLocales,
      type: 'website',
    },
  };
}

export default async function ContactPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['contact']);
  const tSeo = i18n.getFixedT(null, ['seo']);

  const title = tSeo('contact.title');
  const description = tSeo('contact.description');

  const structuredData = buildOrganizationStructuredData({
    name: 'Google-Monetize',
    description,
    locale: i18n.language,
  });

  return (
    <StructuredDataProvider
      title={title}
      description={description}
      locale={i18n.language}
    >
      <SeoStructuredData data={structuredData} />
      <MarketingPageLayout maxWidth="5xl">
        <div className="flex flex-col gap-12">
          <FadeIn>
            <header className="space-y-3 text-center">
              <Heading type={1}>{t('title')}</Heading>
              <SubHeading className="text-muted-foreground">{t('intro')}</SubHeading>
            </header>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Card>
              <CardContent className="space-y-6 p-8">
                <ContactSection
                  title={t('sections.sales.title')}
                  prefix={t('sections.sales.description.prefix')}
                  suffix={t('sections.sales.description.suffix')}
                  email="bd@autoads.dev"
                />

                <div>
                  <h2 className="text-lg font-semibold">
                    {t('sections.product.title')}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('sections.product.description')}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>• {t('sections.product.items.wechat')}</li>
                  </ul>
                </div>

                <ContactSection
                  title={t('sections.support.title')}
                  prefix={t('sections.support.description.prefix')}
                  suffix={t('sections.support.description.suffix')}
                  email="support@autoads.dev"
                />
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </MarketingPageLayout>
    </StructuredDataProvider>
  );
}

function ContactSection({
  title,
  prefix,
  suffix,
  email,
}: {
  title: string;
  prefix: string;
  suffix: string;
  email: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {prefix}
        <a
          href={`mailto:${email}`}
          className="text-primary underline-offset-2 hover:underline"
        >
          {email}
        </a>
        {suffix}
      </p>
    </div>
  );
}
