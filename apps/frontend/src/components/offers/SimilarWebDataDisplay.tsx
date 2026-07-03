'use client';

import { useTranslation } from 'react-i18next';
import { TrendingUp, Globe, Clock, Users, MousePointer, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/core/ui/Card';
import Progress from '~/core/ui/Progress';

interface SimilarWebData {
  globalRank?: number | null;
  categoryRank?: number | null;
  category?: string | null;
  totalVisits?: number | null;
  bounceRate?: number | null;
  pagesPerVisit?: number | null;
  avgVisitDuration?: number | null;
  trafficSources?: {
    direct?: number;
    search?: number;
    social?: number;
    paid?: number;
    referrals?: number;
  } | null;
  topCountryShares?: Array<{
    countryCode: string;
    share: number;
  }> | null;
}

interface SimilarWebDataDisplayProps {
  data: SimilarWebData | null;
  className?: string;
}

/**
 * FE-027: SimilarWebDataDisplay component
 * Displays comprehensive SimilarWeb traffic data with visual charts
 */
export function SimilarWebDataDisplay({ data, className }: SimilarWebDataDisplayProps) {
  const { t } = useTranslation('common');

  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('offers.similarweb.noData', 'No SimilarWeb data available')}
      </div>
    );
  }

  const formatNumber = (num?: number | null) => {
    if (!num) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const formatPercentage = (value?: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className={className}>
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('offers.similarweb.globalRank', 'Global Rank')}</p>
                <p className="text-2xl font-bold">
                  {data.globalRank ? `#${formatNumber(data.globalRank)}` : 'N/A'}
                </p>
              </div>
              <Globe className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('offers.similarweb.monthlyVisits', 'Monthly Visits')}</p>
                <p className="text-2xl font-bold">{formatNumber(data.totalVisits)}</p>
              </div>
              <Users className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('offers.similarweb.avgDuration', 'Avg Duration')}</p>
                <p className="text-2xl font-bold">{formatDuration(data.avgVisitDuration)}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('offers.similarweb.bounceRate', 'Bounce Rate')}</p>
                <p className="text-2xl font-bold">{formatPercentage(data.bounceRate)}</p>
              </div>
              <MousePointer className="h-8 w-8 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category info */}
      {data.category && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('offers.similarweb.category', 'Category')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">{data.category}</span>
              {data.categoryRank && (
                <span className="text-sm font-semibold">
                  {t('offers.similarweb.categoryRank', 'Rank')}: #{formatNumber(data.categoryRank)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Traffic Sources */}
      {data.trafficSources && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('offers.similarweb.trafficSources', 'Traffic Sources')}
            </CardTitle>
            <CardDescription>
              {t('offers.similarweb.trafficSourcesDescription', 'Distribution of traffic by channel')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.trafficSources.direct !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t('offers.similarweb.direct', 'Direct')}</span>
                  <span className="font-medium">{formatPercentage(data.trafficSources.direct)}</span>
                </div>
                <Progress value={(data.trafficSources.direct || 0) * 100} className="h-2" />
              </div>
            )}
            {data.trafficSources.search !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t('offers.similarweb.search', 'Search')}</span>
                  <span className="font-medium">{formatPercentage(data.trafficSources.search)}</span>
                </div>
                <Progress value={(data.trafficSources.search || 0) * 100} className="h-2" />
              </div>
            )}
            {data.trafficSources.social !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t('offers.similarweb.social', 'Social')}</span>
                  <span className="font-medium">{formatPercentage(data.trafficSources.social)}</span>
                </div>
                <Progress value={(data.trafficSources.social || 0) * 100} className="h-2" />
              </div>
            )}
            {data.trafficSources.paid !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t('offers.similarweb.paid', 'Paid Ads')}</span>
                  <span className="font-medium">{formatPercentage(data.trafficSources.paid)}</span>
                </div>
                <Progress value={(data.trafficSources.paid || 0) * 100} className="h-2" />
              </div>
            )}
            {data.trafficSources.referrals !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t('offers.similarweb.referrals', 'Referrals')}</span>
                  <span className="font-medium">{formatPercentage(data.trafficSources.referrals)}</span>
                </div>
                <Progress value={(data.trafficSources.referrals || 0) * 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top Countries */}
      {data.topCountryShares && data.topCountryShares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t('offers.similarweb.topCountries', 'Top Countries')}
            </CardTitle>
            <CardDescription>
              {t('offers.similarweb.topCountriesDescription', 'Geographic traffic distribution')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topCountryShares.slice(0, 5).map((country, index) => (
              <div key={country.countryCode} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground">#{index + 1}</span>
                  <span className="text-sm font-medium">{country.countryCode}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={country.share * 100} className="h-2 w-24" />
                  <span className="text-sm font-medium min-w-[3rem] text-right">
                    {formatPercentage(country.share)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Engagement Metrics */}
      {(data.pagesPerVisit || data.avgVisitDuration) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">{t('offers.similarweb.engagement', 'Engagement Metrics')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {data.pagesPerVisit && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('offers.similarweb.pagesPerVisit', 'Pages per Visit')}
                </p>
                <p className="text-2xl font-bold">{data.pagesPerVisit.toFixed(2)}</p>
              </div>
            )}
            {data.avgVisitDuration && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('offers.similarweb.avgVisitDuration', 'Avg Visit Duration')}
                </p>
                <p className="text-2xl font-bold">{formatDuration(data.avgVisitDuration)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
