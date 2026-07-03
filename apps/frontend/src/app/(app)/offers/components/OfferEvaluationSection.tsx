'use client';

import { useTranslation } from 'react-i18next';
import { BoltIcon, GlobeAltIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

import type { OfferEvaluation } from '~/lib/offers/types';

interface OfferEvaluationSectionProps {
  evaluation: OfferEvaluation;
}

/**
 * @name OfferEvaluationSection
 * @description Displays evaluation results including SimilarWeb data, AI analysis, and token cost
 *
 * Shows different sections based on evaluation type:
 * - Basic: SimilarWeb data + final score
 * - AI (Elite): SimilarWeb data + AI recommendation + final score
 *
 * Ref: frontend-package-offer-evaluation.md - Task A2-3
 */
export function OfferEvaluationSection({
  evaluation,
}: OfferEvaluationSectionProps) {
  const { t } = useTranslation('common');
  const { similarWebData, aiAnalysis, usedAI, tokenCost, evaluatedAt } =
    evaluation;

  return (
    <div className={'flex flex-col space-y-4'}>
      {/* Evaluation Meta Info */}
      <div
        className={
          'flex items-center justify-between rounded-md border border-border bg-muted/40 p-3'
        }
      >
        <div className={'flex items-center gap-2 text-sm'}>
          {usedAI ? (
            <>
              <BoltIcon className={'h-5 w-5 text-primary'} />
              <span className={'font-medium text-foreground'}>{t('offers.evaluation.aiEvaluationType')}</span>
            </>
          ) : (
            <>
              <ChartBarIcon className={'h-5 w-5 text-muted-foreground'} />
              <span className={'font-medium text-foreground'}>{t('offers.evaluation.basicEvaluationType')}</span>
            </>
          )}
        </div>

        <div className={'flex items-center gap-3 text-sm text-muted-foreground'}>
          <span>{t('offers.evaluation.tokensConsumed', { count: tokenCost })}</span>
          <span>·</span>
          <span>{formatDate(evaluatedAt)}</span>
        </div>
      </div>

      {/* Final Score */}
      {evaluation.finalScore !== undefined && (
        <div
          className={
            'rounded-lg border border-border bg-background p-4 text-center'
          }
        >
          <div className={'text-sm font-medium uppercase tracking-wide text-muted-foreground'}>
            {t('offers.evaluation.overallScore')}
          </div>
          <div
            className={`mt-2 text-4xl font-bold ${getScoreColor(evaluation.finalScore)}`}
          >
            {evaluation.finalScore}
          </div>
          <div className={'mt-1 text-xs text-muted-foreground'}>{t('offers.evaluation.outOf100')}</div>
        </div>
      )}

      {/* AI Analysis (Elite Only) */}
      {usedAI && aiAnalysis && (
        <div className={'space-y-3'}>
          <h4 className={'flex items-center gap-2 text-sm font-semibold text-foreground'}>
            <BoltIcon className={'h-4 w-4 text-primary'} />
            {t('offers.evaluation.aiAnalysisTitle')}
          </h4>

          <div className={'rounded-lg border border-border bg-background p-4'}>
            <div className={'mb-3 flex items-center justify-between'}>
              <span className={'text-sm font-medium text-muted-foreground'}>
                {t('offers.evaluation.aiRecommendationScore')}
              </span>
              <span
                className={`text-2xl font-bold ${getScoreColor(aiAnalysis.recommendationScore)}`}
              >
                {aiAnalysis.recommendationScore}
              </span>
            </div>

            {aiAnalysis.category && (
              <div className={'mb-3'}>
                <span className={'inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary'}>
                  {aiAnalysis.category}
                </span>
              </div>
            )}

            {aiAnalysis.strengths && aiAnalysis.strengths.length > 0 && (
              <div className={'mb-3'}>
                <div className={'mb-1 text-xs font-medium text-muted-foreground'}>
                  {t('offers.evaluation.strengths')}
                </div>
                <ul className={'space-y-1'}>
                  {aiAnalysis.strengths.map((strength, index) => (
                    <li
                      key={index}
                      className={'flex items-start gap-2 text-sm'}
                    >
                      <CheckCircleIcon className={'mt-0.5 h-4 w-4 flex-shrink-0 text-green-600'} />
                      <span className={'text-foreground'}>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.weaknesses && aiAnalysis.weaknesses.length > 0 && (
              <div className={'mb-3'}>
                <div className={'mb-1 text-xs font-medium text-muted-foreground'}>
                  {t('offers.evaluation.weaknesses')}
                </div>
                <ul className={'space-y-1'}>
                  {aiAnalysis.weaknesses.map((weakness, index) => (
                    <li
                      key={index}
                      className={'flex items-start gap-2 text-sm'}
                    >
                      <XCircleIcon className={'mt-0.5 h-4 w-4 flex-shrink-0 text-red-600'} />
                      <span className={'text-foreground'}>{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.suggestion && (
              <div
                className={
                  'mt-3 rounded-md bg-primary/5 p-3 text-sm leading-relaxed text-foreground'
                }
              >
                <div className={'mb-1 font-medium'}>{t('offers.evaluation.suggestion')}</div>
                {aiAnalysis.suggestion}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SimilarWeb Data */}
      {similarWebData && (
        <div className={'space-y-3'}>
          <h4 className={'flex items-center gap-2 text-sm font-semibold text-foreground'}>
            <GlobeAltIcon className={'h-4 w-4'} />
            {t('offers.evaluation.similarWebTitle')}
          </h4>

          <div className={'grid gap-3 sm:grid-cols-2'}>
            {similarWebData.globalRank && (
              <MetricCard
                label={t('offers.detail.globalRank')}
                value={`#${similarWebData.globalRank.toLocaleString()}`}
              />
            )}
            {similarWebData.countryRank && (
              <MetricCard
                label={t('offers.evaluation.countryRank')}
                value={`#${similarWebData.countryRank.toLocaleString()}`}
              />
            )}
            {similarWebData.monthlyVisits && (
              <MetricCard
                label={t('offers.detail.monthlyVisits')}
                value={formatNumber(similarWebData.monthlyVisits)}
              />
            )}
            {similarWebData.bounceRate !== undefined && (
              <MetricCard
                label={t('offers.detail.bounceRate')}
                value={`${(similarWebData.bounceRate * 100).toFixed(1)}%`}
              />
            )}
            {similarWebData.pagesPerVisit !== undefined && (
              <MetricCard
                label={t('offers.evaluation.pagesPerVisit')}
                value={similarWebData.pagesPerVisit.toFixed(1)}
              />
            )}
            {similarWebData.avgVisitDuration !== undefined && (
              <MetricCard
                label={t('offers.evaluation.avgVisitDuration')}
                value={formatDuration(similarWebData.avgVisitDuration)}
              />
            )}
          </div>

          {similarWebData.trafficSources && (
            <div className={'rounded-lg border border-border bg-background p-4'}>
              <div className={'mb-3 text-sm font-medium text-foreground'}>
                {t('offers.evaluation.trafficSourcesTitle')}
              </div>
              <div className={'space-y-2'}>
                {Object.entries(similarWebData.trafficSources)
                  .filter(([_, value]) => value !== undefined && value > 0)
                  .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
                  .map(([source, percentage]) => (
                    <div key={source} className={'flex items-center gap-3'}>
                      <div className={'w-16 text-xs capitalize text-muted-foreground'}>
                        {getTrafficSourceLabel(source, t)}
                      </div>
                      <div className={'flex-1'}>
                        <div className={'h-2 overflow-hidden rounded-full bg-muted'}>
                          <div
                            className={'h-full bg-primary transition-all'}
                            style={{ width: `${(percentage ?? 0) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className={'w-12 text-right text-xs font-medium text-foreground'}>
                        {((percentage ?? 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={'rounded-md border border-border bg-background p-3'}>
      <div className={'text-xs text-muted-foreground'}>{label}</div>
      <div className={'mt-1 text-lg font-semibold text-foreground'}>
        {value}
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getTrafficSourceLabel(source: string, t: (key: string) => string): string {
  const labelKeyMap: Record<string, string> = {
    direct: 'offers.evaluation.trafficDirect',
    search: 'offers.evaluation.trafficSearch',
    social: 'offers.evaluation.trafficSocial',
    mail: 'offers.evaluation.trafficMail',
    referrals: 'offers.evaluation.trafficReferrals',
    paid: 'offers.evaluation.trafficPaid',
  };
  return labelKeyMap[source] ? t(labelKeyMap[source]) : source;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default OfferEvaluationSection;
