import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import { MarketingPageLayout } from '~/core/ui/PageLayout';

type FeaturedPost = {
  title: string;
  summary: string;
  category: string;
};

export const metadata = {
  title: 'Blog - Google-Monetize',
};

async function BlogPage() {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing']);

  const posts = t('blogPage.featuredPosts', {
    returnObjects: true,
  }) as FeaturedPost[];

  return (
    <MarketingPageLayout maxWidth="5xl">
      <div className={'flex flex-col gap-12'}>
        <FadeIn>
          <header className={'space-y-4 text-center'}>
            <Heading type={1}>{t('blogPage.hero.title')}</Heading>
            <SubHeading className={'text-muted-foreground'}>
              {t('blogPage.hero.description')}
            </SubHeading>
            <div className={'flex items-center justify-center gap-3'}>
              <Button size={'sm'} variant={'outline'} href="/changelog">
                {t('blogPage.cta.changelog')}
              </Button>
              <Button size={'sm'} variant={'outline'} href="/resources">
                {t('blogPage.cta.resources')}
              </Button>
            </div>
          </header>
        </FadeIn>

        <FadeInStagger className={'grid grid-cols-1 gap-6 md:grid-cols-3'}>
          {posts.map((post) => (
            <FadeInStaggerItem key={post.title}>
              <Card hoverable className={'h-full'}>
                <CardContent className={'flex h-full flex-col gap-3 p-6'}>
                  <span className={'text-xs font-semibold text-primary uppercase tracking-[0.2em]'}>
                    {post.category}
                  </span>
                  <h2 className={'text-lg font-semibold'}>{post.title}</h2>
                  <p className={'flex-1 text-sm leading-6 text-muted-foreground'}>{post.summary}</p>
                  <span className={'text-sm font-medium text-primary'}>
                    {t('blogPage.cta.readMore')}
                  </span>
                </CardContent>
              </Card>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>

        <FadeIn delay={0.3}>
          <Card>
            <CardContent className={'p-8 text-sm text-muted-foreground'}>
              <p>{t('blogPage.migration')}</p>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </MarketingPageLayout>
  );
}

export default BlogPage;
