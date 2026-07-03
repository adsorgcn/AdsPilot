'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Loader2, AlertCircle, Target, Lightbulb } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/core/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/core/ui/Tabs';
import { Alert, AlertDescription, AlertTitle } from '~/core/ui/Alert';
import Badge from '~/core/ui/Badge';
import { ScrollArea } from '~/core/ui/ScrollArea';
import { AIScoreBadge, AIScoreLabel } from './AIScoreBadge';
import { SimilarWebDataDisplay } from './SimilarWebDataDisplay';
import useSupabase from '~/core/hooks/use-supabase';

interface AIEvaluationDialogProps {
  offerId: string;
  open: boolean;
  onClose: () => void;
}

interface Evaluation {
  evaluationId: string;
  offerId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  evaluationType: 'basic' | 'ai_enhanced';
  tokensConsumed: number;
  similarWebScore?: number | null;
  aiRecommendationScore?: number | null;
  aiRecommendation?: any;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * FE-026: AIEvaluationDialog component
 * Displays detailed evaluation results including AI insights and SimilarWeb data
 */
export function AIEvaluationDialog({ offerId, open, onClose }: AIEvaluationDialogProps) {
  const { t } = useTranslation('common');
  const client = useSupabase();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch latest evaluation with smart polling
  const { data: evaluation, error, isLoading } = useQuery({
    queryKey: ['offer-evaluation', offerId],
    queryFn: async () => {
      const url = `/api/v1/offers/${offerId}/evaluations/latest`;
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;

      if (!token) throw new Error('Not authenticated');

      const apiBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseURL) {
        throw new Error('API Gateway URL not configured');
      }

      const response = await fetch(`${apiBaseURL}${url}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch evaluation: ${response.statusText}`);
      }

      return response.json() as Promise<Evaluation>;
    },
    enabled: open && !!offerId,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    // Smart polling: only poll when evaluation is in progress
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const shouldRefresh = data.status === 'pending' || data.status === 'processing';
      return shouldRefresh ? 5000 : false; // Poll every 5 seconds when in progress
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const aiData = evaluation?.aiRecommendation ? JSON.parse(evaluation.aiRecommendation) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('offers.evaluation.detailsTitle', 'Evaluation Results')}
          </DialogTitle>
          <DialogDescription>
            {t('offers.evaluation.detailsDescription', 'Comprehensive offer analysis and recommendations')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  {t('offers.evaluation.loading', 'Loading evaluation...')}
                </p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('offers.evaluation.errorTitle', 'Error loading evaluation')}</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && !evaluation && (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {t('offers.evaluation.noData', 'No evaluation data available for this offer')}
              </p>
            </div>
          )}

          {evaluation && (
            <>
              {/* Status header */}
              <div className="mb-6 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={evaluation.status === 'completed' ? 'default' : 'secondary'}>
                      {evaluation.status}
                    </Badge>
                    <Badge variant="outline">{evaluation.evaluationType}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(evaluation.createdAt).toLocaleString()}
                  </span>
                </div>

                {evaluation.status === 'pending' || evaluation.status === 'processing' ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('offers.evaluation.processing', 'Evaluation in progress...')}</span>
                  </div>
                ) : evaluation.status === 'failed' ? (
                  <Alert variant="destructive" className="mt-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('offers.evaluation.failed', 'Evaluation Failed')}</AlertTitle>
                    <AlertDescription>{evaluation.errorMessage}</AlertDescription>
                  </Alert>
                ) : null}
              </div>

              {evaluation.status === 'completed' && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="overview">{t('offers.evaluation.tabs.overview', 'Overview')}</TabsTrigger>
                    <TabsTrigger value="traffic">{t('offers.evaluation.tabs.traffic', 'Traffic Data')}</TabsTrigger>
                    <TabsTrigger value="insights" disabled={!aiData}>
                      {t('offers.evaluation.tabs.insights', 'AI Insights')}
                    </TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-6">
                    {/* AI Score */}
                    {evaluation.aiRecommendationScore !== null && (
                      <div className="p-6 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            {t('offers.evaluation.aiScore', 'AI Recommendation Score')}
                          </h3>
                          <AIScoreBadge score={evaluation.aiRecommendationScore} size="lg" />
                        </div>
                        <AIScoreLabel score={evaluation.aiRecommendationScore} />
                      </div>
                    )}

                    {/* Top Reasons */}
                    {aiData?.reasons && aiData.reasons.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" />
                          {t('offers.evaluation.keyInsights', 'Key Insights')}
                        </h4>
                        <div className="space-y-2">
                          {aiData.reasons.map((reason: string, index: number) => (
                            <div key={index} className="p-3 rounded-lg border bg-card">
                              <p className="text-sm">{reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Industry & Product Type */}
                    {(aiData?.industry || aiData?.productType) && (
                      <div className="grid grid-cols-2 gap-4">
                        {aiData.industry && (
                          <div className="p-4 rounded-lg border">
                            <p className="text-sm text-muted-foreground mb-1">
                              {t('offers.evaluation.industry', 'Industry')}
                            </p>
                            <p className="font-medium">{aiData.industry}</p>
                          </div>
                        )}
                        {aiData.productType && (
                          <div className="p-4 rounded-lg border">
                            <p className="text-sm text-muted-foreground mb-1">
                              {t('offers.evaluation.productType', 'Product Type')}
                            </p>
                            <p className="font-medium">{aiData.productType}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  {/* Traffic Data Tab */}
                  <TabsContent value="traffic">
                    <SimilarWebDataDisplay data={aiData?.similarWebData || null} />
                  </TabsContent>

                  {/* AI Insights Tab */}
                  <TabsContent value="insights" className="space-y-6">
                    {aiData && (
                      <>
                        {/* Traffic Insights */}
                        {aiData.trafficInsights && (
                          <div className="space-y-3">
                            <h4 className="font-semibold">{t('offers.evaluation.trafficInsights', 'Traffic Insights')}</h4>
                            <div className="p-4 rounded-lg border bg-card">
                              <p className="text-sm">{aiData.trafficInsights.summary}</p>
                              {aiData.trafficInsights.keyMetric && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  <strong>Key Metric:</strong> {aiData.trafficInsights.keyMetric}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Geographic Insights */}
                        {aiData.geoInsights && (
                          <div className="space-y-3">
                            <h4 className="font-semibold">{t('offers.evaluation.geoInsights', 'Geographic Insights')}</h4>
                            <div className="p-4 rounded-lg border bg-card space-y-2">
                              {aiData.geoInsights.topMarkets && (
                                <p className="text-sm">
                                  <strong>Top Markets:</strong> {aiData.geoInsights.topMarkets.join(', ')}
                                </p>
                              )}
                              {aiData.geoInsights.adPlatformFit && (
                                <p className="text-sm">
                                  <strong>Platform Fit:</strong> {aiData.geoInsights.adPlatformFit}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Budget Recommendation */}
                        {aiData.budgetRecommendation && (
                          <div className="space-y-3">
                            <h4 className="font-semibold">{t('offers.evaluation.budgetRecommendation', 'Budget Recommendation')}</h4>
                            <div className="grid grid-cols-2 gap-4">
                              {aiData.budgetRecommendation.testingPhase && (
                                <div className="p-4 rounded-lg border bg-card">
                                  <p className="text-sm font-medium mb-2">Testing Phase</p>
                                  <div className="text-xs space-y-1 text-muted-foreground">
                                    <p>Duration: {aiData.budgetRecommendation.testingPhase.duration}</p>
                                    <p>Daily Budget: {aiData.budgetRecommendation.testingPhase.dailyBudget}</p>
                                    <p>Total: {aiData.budgetRecommendation.testingPhase.totalBudget}</p>
                                  </div>
                                </div>
                              )}
                              {aiData.budgetRecommendation.scalingPhase && (
                                <div className="p-4 rounded-lg border bg-card">
                                  <p className="text-sm font-medium mb-2">Scaling Phase</p>
                                  <div className="text-xs space-y-1 text-muted-foreground">
                                    <p>Trigger: {aiData.budgetRecommendation.scalingPhase.triggerCondition}</p>
                                    <p>Daily Budget: {aiData.budgetRecommendation.scalingPhase.dailyBudget}</p>
                                    <p>Max: {aiData.budgetRecommendation.scalingPhase.maxDailyBudget}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
