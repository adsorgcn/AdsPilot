import { notFound } from 'next/navigation';

interface PageParams {
  params: {
    slug: string[];
  };
}

export const generateMetadata = ({ params }: PageParams) => {
  return {
    title: `${params.slug.join('/')} | Google-Monetize 文档（建设中）`,
  };
};

function DocumentationPage() {
  return notFound();
}

export default DocumentationPage;
