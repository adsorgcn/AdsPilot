import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import FaqItem from '~/app/(site)/components/FaqItem';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';

export const metadata = {
  title: 'FAQ',
};

export default async function FAQPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);

  const faqItems = t('pricing.faq.items', { returnObjects: true }) as Array<{
    question: string;
    answer: string;
  }>;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        key={'ld:json'}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <MarketingPageLayout maxWidth="5xl">
        <div className={'flex flex-col space-y-8'}>
          <FadeIn>
            <div className={'flex flex-col items-center space-y-4'}>
              <Heading type={1}>{t('pricing.faq.title')}</Heading>
              <SubHeading className="text-muted-foreground">
                {t('pricing.faq.subtitle')}
              </SubHeading>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className={'mx-auto flex w-full justify-center md:max-w-xl'}>
              <Card className="w-full">
                <CardContent className="p-6">
                  <div className="flex w-full flex-col">
                    {faqItems.map((item, index) => (
                      <FaqItem key={index} item={item} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </FadeIn>
        </div>
      </MarketingPageLayout>
    </>
  );
}
