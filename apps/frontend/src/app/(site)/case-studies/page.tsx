import { MarketingPageLayout } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
// import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import StructuredDataProvider from '~/components/StructuredDataProvider';
import type { Metadata } from 'next';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import configuration from '~/configuration';

type CaseStudy = {
  title: string;
  industry: string;
  beforeMetrics: {
    roi: string;
    monthlySpend: string;
    conversionRate: string;
  };
  afterMetrics: {
    roi: string;
    monthlySpend: string;
    conversionRate: string;
  };
  description: string;
  challenges: string[];
  solution: string;
  results: string[];
  testimonial?: {
    name: string;
    role: string;
    content: string;
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['seo']);
  const baseUrl = configuration.site.siteUrl as string;

  return {
    title: t('caseStudies.title'),
    description: t('caseStudies.description'),
    keywords: t('caseStudies.keywords'),
    authors: [{ name: 'Google-Monetize Team' }],
    creator: 'Google-Monetize',
    publisher: 'Google-Monetize',
    openGraph: {
      type: 'website',
      locale: i18n.language,
      url: `${baseUrl}/case-studies`,
      title: t('caseStudies.title'),
      description: t('caseStudies.description'),
      siteName: configuration.site.siteName,
      images: [
        {
          url: `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: 'Google-Monetize Customer Success Stories',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: configuration.site.twitterHandle,
      creator: configuration.site.twitterHandle,
      title: t('caseStudies.title'),
      description: t('caseStudies.description'),
      images: [`${baseUrl}/twitter-image.jpg`],
    },
    alternates: {
      canonical: `${baseUrl}/case-studies`,
    },
  };
}

export default async function CaseStudiesPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);
  const tSeo = i18n.getFixedT(null, ['seo']);

  const caseStudies: CaseStudy[] = [
    {
      title: t('caseStudies.items.fitness.title'),
      industry: t('caseStudies.items.fitness.industry'),
      beforeMetrics: {
        roi: '低ROI，高广告浪费',
        monthlySpend: '$8,500',
        conversionRate: '1.2%'
      },
      afterMetrics: {
        roi: '380%',
        monthlySpend: '$2,200',
        conversionRate: '4.6%'
      },
      description: t('caseStudies.items.fitness.description'),
      challenges: [
        t('caseStudies.items.fitness.challenges.0'),
        t('caseStudies.items.fitness.challenges.1'),
        t('caseStudies.items.fitness.challenges.2')
      ],
      solution: t('caseStudies.items.fitness.solution'),
      results: [
        t('caseStudies.items.fitness.results.0'),
        t('caseStudies.items.fitness.results.1'),
        t('caseStudies.items.fitness.results.2'),
        t('caseStudies.items.fitness.results.3')
      ],
      testimonial: {
        name: t('caseStudies.items.fitness.testimonial.name'),
        role: t('caseStudies.items.fitness.testimonial.role'),
        content: t('caseStudies.items.fitness.testimonial.content')
      }
    },
    {
      title: t('caseStudies.items.ecommerce.title'),
      industry: t('caseStudies.items.ecommerce.industry'),
      beforeMetrics: {
        roi: '广告ROI不明确',
        monthlySpend: '$12,300',
        conversionRate: '0.8%'
      },
      afterMetrics: {
        roi: '节省$1,200浪费/月',
        monthlySpend: '$7,100',
        conversionRate: '2.3%'
      },
      description: t('caseStudies.items.ecommerce.description'),
      challenges: [
        t('caseStudies.items.ecommerce.challenges.0'),
        t('caseStudies.items.ecommerce.challenges.1'),
        t('caseStudies.items.ecommerce.challenges.2')
      ],
      solution: t('caseStudies.items.ecommerce.solution'),
      results: [
        t('caseStudies.items.ecommerce.results.0'),
        t('caseStudies.items.ecommerce.results.1'),
        t('caseStudies.items.ecommerce.results.2')
      ]
    },
    {
      title: t('caseStudies.items.multiregion.title'),
      industry: t('caseStudies.items.multiregion.industry'),
      beforeMetrics: {
        roi: '单一市场测试',
        monthlySpend: '$5,500',
        conversionRate: '1.8%'
      },
      afterMetrics: {
        roi: '310%',
        monthlySpend: '$15,800',
        conversionRate: '3.9%'
      },
      description: t('caseStudies.items.multiregion.description'),
      challenges: [
        t('caseStudies.items.multiregion.challenges.0'),
        t('caseStudies.items.multiregion.challenges.1'),
        t('caseStudies.items.multiregion.challenges.2')
      ],
      solution: t('caseStudies.items.multiregion.solution'),
      results: [
        t('caseStudies.items.multiregion.results.0'),
        t('caseStudies.items.multiregion.results.1'),
        t('caseStudies.items.multiregion.results.2'),
        t('caseStudies.items.multiregion.results.3')
      ]
    }
  ];

  const title = tSeo('caseStudies.title');
  const description = tSeo('caseStudies.description');

  return (
    <StructuredDataProvider
      title={title}
      description={description}
      locale={i18n.language}
    >
      <MarketingPageLayout maxWidth="6xl">
        <div className="flex flex-col gap-16">
          <FadeIn>
            <header className="text-center space-y-4">
              <Heading type={1}>{t('caseStudies.hero.title')}</Heading>
              <SubHeading className="text-xl text-muted-foreground max-w-3xl mx-auto">
                {t('caseStudies.hero.description')}
              </SubHeading>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
                  <span className="font-semibold text-primary">380%</span>
                  <span className="text-muted-foreground">最高ROI提升</span>
                </div>
                <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full">
                  <span className="font-semibold text-green-700">$1,200</span>
                  <span className="text-muted-foreground">月度节省</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full">
                  <span className="font-semibold text-blue-700">50+</span>
                  <span className="text-muted-foreground">全球地区</span>
                </div>
              </div>
            </header>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
              {caseStudies.map((study) => (
                <FadeIn key={study.title}>
                  <Card className="group hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full mb-2">
                            {study.industry}
                          </span>
                          <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                            {study.title}
                          </h3>
                        </div>
                        <div className="text-3xl font-bold text-primary">
                          +{study.afterMetrics.roi}
                        </div>
                      </div>

                      <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                        {study.description}
                      </p>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <div>
                            <p className="text-xs text-red-600 font-semibold">优化前</p>
                            <p className="text-sm text-red-900">{study.beforeMetrics.monthlySpend}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-red-600 font-semibold">{study.beforeMetrics.conversionRate}</p>
                            <p className="text-sm text-red-900">{study.beforeMetrics.roi}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div>
                            <p className="text-xs text-green-600 font-semibold">优化后</p>
                            <p className="text-sm text-green-900">{study.afterMetrics.monthlySpend}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-green-600 font-semibold">{study.afterMetrics.conversionRate}</p>
                            <p className="text-sm text-green-900 font-bold">{study.afterMetrics.roi}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">
                            {t('caseStudies.labels.challenges')}
                          </h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {study.challenges.map((challenge, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                                <span>{challenge}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">
                            {t('caseStudies.labels.solution')}
                          </h4>
                          <p className="text-sm text-muted-foreground">{study.solution}</p>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">
                            {t('caseStudies.labels.results')}
                          </h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {study.results.map((result, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                <span>{result}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {study.testimonial && (
                        <div className="border-t pt-4 mt-6">
                          <blockquote className="text-sm italic text-muted-foreground">
                            &ldquo;{study.testimonial.content}&rdquo;
                          </blockquote>
                          <div className="flex items-center gap-3 mt-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-primary font-semibold">
                                {study.testimonial.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {study.testimonial.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {study.testimonial.role}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </FadeIn>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.4}>
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-8 text-center">
                <Heading type={2} className="mb-4">
                  {t('caseStudies.cta.title')}
                </Heading>
                <SubHeading className="text-muted-foreground mb-6">
                  {t('caseStudies.cta.description')}
                </SubHeading>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" href="/pricing">
                    {t('caseStudies.cta.getStarted')}
                  </Button>
                  <Button size="lg" variant="outline" href="/contact">
                    {t('caseStudies.cta.consultation')}
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