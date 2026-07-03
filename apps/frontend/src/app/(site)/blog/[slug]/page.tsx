import { notFound } from 'next/navigation';
import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { Card, CardContent } from '~/components/ui/card';
import Button from '~/core/ui/Button';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';

type BlogPostMetadata = {
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  readingTime: string;
  author?: string;
};

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  try {
    const contentPath = path.join(process.cwd(), 'content', 'blog', `${params.slug}.md`);
    const fileContent = await fs.readFile(contentPath, 'utf8');
    const { data } = matter(fileContent);

    return {
      title: `${data.title} | Google-Monetize Blog`,
      description: data.description || '',
    };
  } catch {
    return {
      title: 'Blog Post | Google-Monetize',
    };
  }
}

async function BlogPost({ params }: { params: { slug: string } }) {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['marketing', 'common']);

  try {
    const contentPath = path.join(process.cwd(), 'content', 'blog', `${params.slug}.md`);
    const fileContent = await fs.readFile(contentPath, 'utf8');
    const { data, content } = matter(fileContent);
    const metadata = data as BlogPostMetadata;

    return (
      <MarketingPageLayout maxWidth="6xl">
        <article className="flex flex-col gap-8 py-12">
          {/* Header */}
          <header className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-primary">{metadata.category}</span>
              <span className="text-muted-foreground">•</span>
              <time className="text-muted-foreground">{metadata.publishedAt}</time>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{metadata.readingTime}</span>
            </div>

            <Heading type={1}>{metadata.title}</Heading>

            <SubHeading className="text-muted-foreground">
              {metadata.description}
            </SubHeading>

            {metadata.author && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('common:by')}</span>
                <span className="font-medium">{metadata.author}</span>
              </div>
            )}
          </header>

          {/* Content */}
          <Card>
            <CardContent className="prose prose-gray dark:prose-invert max-w-none p-8">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
              >
                {content}
              </ReactMarkdown>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-8 text-center">
              <Heading type={3}>{t('marketing:blogPage.cta.title')}</Heading>
              <p className="mt-3 text-sm text-muted-foreground">
                {t('marketing:blogPage.cta.description')}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" href="/auth">
                  {t('marketing:pricing.cta.primary')}
                </Button>
                <Button size="lg" variant="outline" href="/blog">
                  {t('marketing:blogPage.cta.backToBlog')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </article>
      </MarketingPageLayout>
    );
  } catch (error) {
    console.error('Error loading blog post:', error);
    return notFound();
  }
}

export default BlogPost;
