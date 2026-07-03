import configuration from '~/configuration';

interface StructuredDataBase {
  '@context': 'https://schema.org';
  '@type': string;
}

interface Organization extends StructuredDataBase {
  '@type': 'Organization';
  '@id': string;
  name: string;
  url: string;
  logo: string;
  description?: string;
  contactPoint?: {
    '@type': 'ContactPoint';
    email: string;
    contactType: string;
    availableLanguage: string[];
  };
  sameAs?: string[];
  areaServed?: Array<{
    '@type': 'Country';
    name: string;
  }>;
}

interface WebSite extends StructuredDataBase {
  '@type': 'WebSite';
  '@id': string;
  url: string;
  name: string;
  description: string;
  inLanguage: string;
  potentialAction?: {
    '@type': 'SearchAction';
    target: string;
    'query-input': string;
  };
  publisher?: {
    '@type': 'Organization';
    '@id': string;
  };
}

interface Service extends StructuredDataBase {
  '@type': 'Service';
  '@id': string;
  name: string;
  description: string;
  provider?: {
    '@type': 'Organization';
    '@id': string;
  };
  serviceType?: string;
  areaServed?: string;
  hasOfferCatalog?: {
    '@type': 'OfferCatalog';
    name: string;
    itemListElement?: Array<{
      '@type': 'Offer';
      itemOffered?: {
        '@type': 'Service';
        name: string;
      };
    }>;
  };
}

interface FAQPage extends StructuredDataBase {
  '@type': 'FAQPage';
  mainEntity?: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer?: {
      '@type': 'Answer';
      text: string;
    };
  }>;
}

interface BreadcrumbList extends StructuredDataBase {
  '@type': 'BreadcrumbList';
  itemListElement?: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item?: string;
  }>;
}

interface Article extends StructuredDataBase {
  '@type': 'Article';
  '@id': string;
  headline: string;
  description: string;
  image?: string[];
  datePublished?: string;
  dateModified?: string;
  author?: {
    '@type': 'Organization';
    name: string;
    url: string;
  };
  publisher?: {
    '@type': 'Organization';
    name: string;
    logo?: {
      '@type': 'ImageObject';
      url: string;
      width: number;
      height: number;
    };
  };
  mainEntityOfPage?: {
    '@type': 'WebPage';
    '@id': string;
  };
}

interface Product extends StructuredDataBase {
  '@type': 'Product';
  name: string;
  description: string;
  brand?: {
    '@type': 'Brand';
    name: string;
  };
  offers?: Array<{
    '@type': 'Offer';
    name: string;
    price: string;
    priceCurrency: string;
    availability?: string;
    validFrom?: string;
  }>;
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    reviewCount: string;
    bestRating: string;
    worstRating: string;
  };
}

interface Course extends StructuredDataBase {
  '@type': 'Course';
  name: string;
  description: string;
  provider?: {
    '@type': 'Organization';
    name: string;
    url: string;
  };
  hasCourseInstance?: Array<{
    '@type': 'CourseInstance';
    courseMode?: string;
    instructor?: {
      '@type': 'Person';
      name: string;
    };
  }>;
  offers?: Array<{
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
    availability?: string;
  }>;
}

interface Event extends StructuredDataBase {
  '@type': 'Event';
  name: string;
  description: string;
  startDate?: string;
  endDate?: string;
  location?: {
    '@type': 'VirtualLocation';
    url: string;
  };
  organizer?: {
    '@type': 'Organization';
    name: string;
    url: string;
  };
  offers?: Array<{
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
    availability?: string;
  }>;
}

interface VideoObject extends StructuredDataBase {
  '@type': 'VideoObject';
  name: string;
  description: string;
  thumbnailUrl?: string;
  uploadDate?: string;
  duration?: string;
  contentUrl?: string;
  embedUrl?: string;
  publisher?: {
    '@type': 'Organization';
    name: string;
    logo?: {
      '@type': 'ImageObject';
      url: string;
    };
  };
}

interface HowTo extends StructuredDataBase {
  '@type': 'HowTo';
  name: string;
  description: string;
  image?: string[];
  step?: Array<{
    '@type': 'HowToStep';
    name: string;
    text: string;
    image?: string;
  }>;
  tool?: Array<{
    '@type': 'HowToTool';
    name: string;
  }>;
  supply?: Array<{
    '@type': 'HowToSupply';
    name: string;
  }>;
  totalTime?: string;
  estimatedCost?: {
    '@type': 'MonetaryAmount';
    currency: string;
    value: string;
  };
}

interface SoftwareApplication extends StructuredDataBase {
  '@type': 'SoftwareApplication';
  name: string;
  description: string;
  applicationCategory: string;
  operatingSystem?: string;
  offers?: Array<{
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
    availability?: string;
  }>;
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    reviewCount: string;
    bestRating?: string;
    worstRating?: string;
  };
  featureList?: string[];
  screenshot?: string[];
}

interface LocalBusiness extends StructuredDataBase {
  '@type': 'LocalBusiness';
  name: string;
  description: string;
  url: string;
  telephone?: string;
  address?: {
    '@type': 'PostalAddress';
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  geo?: {
    '@type': 'GeoCoordinates';
    latitude: number;
    longitude: number;
  };
  openingHours?: string[];
  priceRange?: string;
  servesCuisine?: string[];
}

interface Review extends StructuredDataBase {
  '@type': 'Review';
  itemReviewed: {
    '@type': string;
    name: string;
  };
  reviewRating: {
    '@type': 'Rating';
    ratingValue: string;
    bestRating: string;
    worstRating: string;
  };
  author?: {
    '@type': 'Person';
    name: string;
  };
  reviewBody?: string;
  datePublished?: string;
}

interface Person extends StructuredDataBase {
  '@type': 'Person';
  name: string;
  description?: string;
  url?: string;
  image?: string;
  jobTitle?: string;
  worksFor?: {
    '@type': 'Organization';
    name: string;
  };
  sameAs?: string[];
}

export type StructuredData =
  | Organization
  | WebSite
  | Service
  | FAQPage
  | BreadcrumbList
  | Article
  | Product
  | Course
  | Event
  | VideoObject
  | HowTo
  | SoftwareApplication
  | LocalBusiness
  | Review
  | Person;

class StructuredDataBuilder {
  private data: StructuredData;

  constructor(type: StructuredData['@type']) {
    this.data = {
      '@context': 'https://schema.org',
      '@type': type,
    } as StructuredData;
  }

  organization(data: Partial<Organization>): this {
    Object.assign(this.data, data);
    return this;
  }

  webSite(data: Partial<WebSite>): this {
    Object.assign(this.data, data);
    return this;
  }

  service(data: Partial<Service>): this {
    Object.assign(this.data, data);
    return this;
  }

  faqPage(data: Partial<FAQPage>): this {
    Object.assign(this.data, data);
    return this;
  }

  breadcrumbList(data: Partial<BreadcrumbList>): this {
    Object.assign(this.data, data);
    return this;
  }

  article(data: Partial<Article>): this {
    Object.assign(this.data, data);
    return this;
  }

  product(data: Partial<Product>): this {
    Object.assign(this.data, data);
    return this;
  }

  course(data: Partial<Course>): this {
    Object.assign(this.data, data);
    return this;
  }

  event(data: Partial<Event>): this {
    Object.assign(this.data, data);
    return this;
  }

  videoObject(data: Partial<VideoObject>): this {
    Object.assign(this.data, data);
    return this;
  }

  howTo(data: Partial<HowTo>): this {
    Object.assign(this.data, data);
    return this;
  }

  softwareApplication(data: Partial<SoftwareApplication>): this {
    Object.assign(this.data, data);
    return this;
  }

  localBusiness(data: Partial<LocalBusiness>): this {
    Object.assign(this.data, data);
    return this;
  }

  review(data: Partial<Review>): this {
    Object.assign(this.data, data);
    return this;
  }

  person(data: Partial<Person>): this {
    Object.assign(this.data, data);
    return this;
  }

  build(): StructuredData {
    return this.data;
  }
}

export function createStructuredData(type: StructuredData['@type']): StructuredDataBuilder {
  return new StructuredDataBuilder(type);
}

export function buildOrganizationStructuredData({
  name,
  description,
  locale,
}: {
  name: string;
  description: string;
  locale: string;
}): Organization {
  const siteUrl = configuration.site.siteUrl as string;
  const normalizedSiteUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  const twitterHandle = configuration.site.twitterHandle?.replace('@', '') ?? '';

  const sameAs = [] as string[];

  if (twitterHandle) {
    sameAs.push(`https://twitter.com/${twitterHandle}`);
  }

  if (configuration.site.githubHandle) {
    sameAs.push(`https://github.com/${configuration.site.githubHandle}`);
  }

  return createStructuredData('Organization')
    .organization({
      '@id': `${normalizedSiteUrl}#organization`,
      name,
      url: normalizedSiteUrl,
      logo: `${normalizedSiteUrl}/assets/images/favicon/android-chrome-512x512.png`,
      description,
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'support@autoads.dev',
        contactType: 'customer support',
        availableLanguage: ['en', 'zh-CN'],
      },
      sameAs: sameAs.length > 0 ? sameAs : undefined,
      areaServed: [
        {
          '@type': 'Country',
          name: locale === 'zh-CN' ? 'China' : 'United States',
        },
        {
          '@type': 'Country',
          name: locale === 'zh-CN' ? 'United States' : 'China',
        },
      ],
    })
    .build() as Organization;
}

export function buildWebSiteStructuredData({
  title,
  description,
  locale,
}: {
  title: string;
  description: string;
  locale: string;
}): WebSite {
  const siteUrl = configuration.site.siteUrl as string;
  const normalizedSiteUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;

  return createStructuredData('WebSite')
    .webSite({
      '@id': `${normalizedSiteUrl}#website`,
      url: normalizedSiteUrl,
      name: title,
      description,
      inLanguage: locale,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${normalizedSiteUrl}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
      publisher: {
        '@type': 'Organization',
        '@id': `${normalizedSiteUrl}#organization`,
      },
    })
    .build() as WebSite;
}

export function buildServiceStructuredData({
  name,
  description,
}: {
  name: string;
  description: string;
}): Service {
  const siteUrl = configuration.site.siteUrl as string;
  const normalizedSiteUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;

  return createStructuredData('Service')
    .service({
      '@id': `${normalizedSiteUrl}#service`,
      name,
      description,
      provider: {
        '@type': 'Organization',
        '@id': `${normalizedSiteUrl}#organization`,
      },
      serviceType: 'Marketing Analysis Service',
      areaServed: 'Worldwide',
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Google-Monetize Services',
        itemListElement: [
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: '12-Dimension AI Evaluation',
            },
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Real Click Simulation',
            },
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Global Proxy IP Testing',
            },
          },
        ],
      },
    })
    .build() as Service;
}

export function buildBreadcrumbStructuredData({
  breadcrumbs,
}: {
  breadcrumbs: Array<{ name: string; url: string }>;
}): BreadcrumbList {
  return createStructuredData('BreadcrumbList')
    .breadcrumbList({
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    })
    .build() as BreadcrumbList;
}

export function buildFAQStructuredData({
  faqs,
}: {
  faqs: Array<{ question: string; answer: string }>;
}): FAQPage {
  return createStructuredData('FAQPage')
    .faqPage({
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    })
    .build() as FAQPage;
}

export function buildArticleStructuredData({
  title,
  description,
  url,
  imageUrl,
  datePublished,
  dateModified,
}: {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  datePublished?: string;
  dateModified?: string;
}): Article {
  const siteUrl = configuration.site.siteUrl as string;
  const normalizedSiteUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;

  return createStructuredData('Article')
    .article({
      '@id': url,
      headline: title,
      description,
      image: imageUrl ? [imageUrl] : undefined,
      datePublished,
      dateModified,
      author: {
        '@type': 'Organization',
        name: 'Google-Monetize Team',
        url: normalizedSiteUrl,
      },
      publisher: {
        '@type': 'Organization',
        name: configuration.site.siteName,
        logo: {
          '@type': 'ImageObject',
          url: `${normalizedSiteUrl}/assets/images/favicon/android-chrome-512x512.png`,
          width: 512,
          height: 512,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url,
      },
    })
    .build() as Article;
}

export function buildSoftwareApplicationStructuredData({
  name,
  description,
  offers,
  aggregateRating,
}: {
  name: string;
  description: string;
  offers?: Array<{
    name: string;
    price: string;
    priceCurrency: string;
    availability?: string;
  }>;
  aggregateRating?: {
    ratingValue: string;
    reviewCount: string;
  };
}): SoftwareApplication {
  return createStructuredData('SoftwareApplication')
    .softwareApplication({
      name,
      description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web Browser',
      offers: offers?.map(offer => ({
        '@type': 'Offer',
        ...offer,
        availability: offer.availability || 'https://schema.org/InStock',
      })),
      aggregateRating: aggregateRating ? {
        '@type': 'AggregateRating',
        ...aggregateRating,
        bestRating: '5',
        worstRating: '1',
      } : undefined,
      featureList: [
        '12-Dimension AI Analysis',
        'Real Click Simulation',
        'Global Proxy IP Testing',
        'Smart Budget Recommendations',
        'Multi-region Campaign Management',
      ],
    })
    .build() as SoftwareApplication;
}

export {
  type Organization,
  type WebSite,
  type Service,
  type FAQPage,
  type BreadcrumbList,
  type Article,
  type Product,
  type Course,
  type Event,
  type VideoObject,
  type HowTo,
  type SoftwareApplication,
  type LocalBusiness,
  type Review,
  type Person,
};
