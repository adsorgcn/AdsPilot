export type MarketingHero = {
  totalEvaluations: number;
  averageAiRecommendation: number;
  activeAdvertisers: number;
  avgTimeToValueMinutes: number;
  newOffersLast30Days: number;
};

export type IndustryInsight = {
  industry: string;
  count: number;
};

export type MarketingPainPoint = {
  title: string;
  description: string;
  metric: string;
};

export type MarketingComparison = {
  title: string;
  description: string;
  highlights: string[];
};

export type MarketingTestimonial = {
  name: string;
  role: string;
  company: string;
  avatar: string;
  quote: string;
  improvement: string;
};

export type MarketingLogo = {
  name: string;
  logo: string;
  href: string;
};

export type MarketingFeature = {
  title: string;
  description: string;
  icon: string;
  highlights: string[];
};

export type MarketingTimelineStep = {
  title: string;
  description: string;
  result: string;
};

export type MarketingResourceGuide = {
  title: string;
  description: string;
  href: string;
};

export type MarketingSummary = {
  hero: MarketingHero;
  topIndustries: IndustryInsight[];
  painPoints: MarketingPainPoint[];
  comparisons: MarketingComparison[];
  testimonials: MarketingTestimonial[];
  customerLogos: MarketingLogo[];
  featureSections: MarketingFeature[];
  timeline: MarketingTimelineStep[];
  resources: MarketingResourceGuide[];
  generatedAt: string;
};
