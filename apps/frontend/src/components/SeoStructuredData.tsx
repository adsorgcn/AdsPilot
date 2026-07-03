import type { StructuredData } from '~/lib/structured-data';

type SeoStructuredDataProps = {
  data: StructuredData | Record<string, unknown>;
};

export default function SeoStructuredData({ data }: SeoStructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}
