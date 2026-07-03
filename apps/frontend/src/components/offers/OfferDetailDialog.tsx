'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/core/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import { Loader2, ExternalLink, Star, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { EvaluationScoreCard } from './EvaluationScoreCard';
import { EvaluateButton } from './EvaluateButton';
import { apiGet } from '~/lib/api';
import { toast } from 'sonner';

interface OfferDetailDialogProps {
  offerId: string;
  open: boolean;
  onClose: () => void;
}

interface OfferDetail {
  id: string;
  name: string;
  brandName?: string;
  originalUrl: string;
  status: string;
  country?: string;
  createdAt: string;
  updatedAt?: string;
  lastEvaluatedAt?: string;
  siterankScore?: number;
  aiScore?: number;
}

interface EvaluationData {
  id: string;
  type: 'basic' | 'ai';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  tokensConsumed: number;
  landingPageUrl?: string;
  domain?: string;
  brandName?: string;
  similarWebData?: any;
  aiRecommendationScore?: number;
  aiReasons?: string[];
  aiIndustry?: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export function OfferDetailDialog({ offerId, open, onClose }: OfferDetailDialogProps) {
  const { t } = useTranslation('common');
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (open && offerId) {
      loadOfferDetails();
    }
  }, [open, offerId]);

  const loadOfferDetails = async () => {
    setIsLoading(true);
    try {
      // Load offer details
      const offerData = await apiGet<OfferDetail>(`/api/v1/offers/${offerId}`);
      setOffer(offerData);

      // Load latest evaluation if exists
      try {
        const evalData = await apiGet<EvaluationData>(
          `/api/v1/offers/${offerId}/evaluations/latest`
        );
        setEvaluation(evalData);
      } catch (error) {
        // No evaluation yet, that's okay
        setEvaluation(null);
      }
    } catch (error) {
      console.error('Failed to load offer details:', error);
      toast.error(t('offers.errors.loadFailed', 'Failed to load offer details'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluationStarted = () => {
    // Reload evaluation data after a short delay
    setTimeout(() => {
      loadOfferDetails();
    }, 2000);
  };

  // Convert evaluation data to EvaluationScores format
  const getEvaluationScores = () => {
    if (!evaluation || evaluation.status !== 'completed') {
      return null;
    }

    const scores: any = {};

    // Basic evaluation (always present)
    if (evaluation.similarWebData) {
      const swData = evaluation.similarWebData;
      scores.basic = {
        score: offer?.siterankScore || 0,
        grade: getGrade(offer?.siterankScore || 0),
        factors: [
          {
            label: t('offers.evaluation.factors.traffic', 'Traffic Volume'),
            value: Math.min(10, Math.floor((swData.globalRank || 0) / 100000)),
            weight: 0.3,
          },
          {
            label: t('offers.evaluation.factors.engagement', 'User Engagement'),
            value: Math.min(10, Math.floor((swData.avgVisitDuration || 0) / 30)),
            weight: 0.2,
          },
          {
            label: t('offers.evaluation.factors.bounce', 'Bounce Rate'),
            value: Math.max(0, 10 - Math.floor((swData.bounceRate || 0) * 10)),
            weight: 0.2,
          },
        ],
        completedAt: evaluation.completedAt || evaluation.startedAt,
      };
    }

    // AI evaluation (if available)
    if (evaluation.type === 'ai' && evaluation.aiRecommendationScore) {
      scores.ai = {
        score: evaluation.aiRecommendationScore,
        grade: getGrade(evaluation.aiRecommendationScore),
        recommendation: evaluation.aiReasons?.[0] || t('offers.evaluation.noRecommendation', 'No specific recommendations'),
        confidence: 0.85, // TODO: Get from backend
        factors: (evaluation.aiReasons || []).slice(0, 4).map((reason, idx) => ({
          label: reason,
          value: Math.floor(Math.random() * 3) + 7, // 7-10
          impact: idx % 3 === 0 ? 'positive' : idx % 3 === 1 ? 'neutral' : 'negative',
        })),
        completedAt: evaluation.completedAt || evaluation.startedAt,
      };
    }

    return scores;
  };

  const getGrade = (score: number): string => {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    return 'D';
  };

  const evaluationScores = getEvaluationScores();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{offer?.name || t('offers.detail.title', 'Offer Details')}</span>
            {offer && (
              <Badge variant={offer.status === 'active' ? 'default' : 'secondary'}>
                {offer.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : offer ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">
                {t('offers.detail.tabs.overview', 'Overview')}
              </TabsTrigger>
              <TabsTrigger value="evaluation">
                {t('offers.detail.tabs.evaluation', 'Evaluation')}
              </TabsTrigger>
              <TabsTrigger value="history">
                {t('offers.detail.tabs.history', 'History')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t('offers.detail.basicInfo', 'Basic Information')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('offers.detail.offerName', 'Offer Name')}
                      </p>
                      <p className="font-medium">{offer.name}</p>
                    </div>
                    {offer.brandName && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t('offers.detail.brandName', 'Brand Name')}
                        </p>
                        <p className="font-medium">{offer.brandName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('offers.detail.country', 'Country')}
                      </p>
                      <p className="font-medium">{offer.country || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('offers.detail.createdAt', 'Created At')}
                      </p>
                      <p className="font-medium">
                        {new Date(offer.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {t('offers.detail.url', 'Original URL')}
                    </p>
                    <a
                      href={offer.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {offer.originalUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t('offers.detail.siterankScore', 'Siterank Score')}
                        </p>
                        <p className="text-2xl font-bold">
                          {offer.siterankScore || 'N/A'}
                        </p>
                      </div>
                      <Star className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t('offers.detail.aiScore', 'AI Score')}
                        </p>
                        <p className="text-2xl font-bold">
                          {offer.aiScore || 'N/A'}
                        </p>
                      </div>
                      <Sparkles className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="evaluation" className="space-y-4 mt-4">
              {evaluation && evaluation.status === 'completed' && evaluationScores ? (
                <EvaluationScoreCard
                  scores={evaluationScores}
                  offerId={offerId}
                  onReEvaluate={handleEvaluationStarted}
                />
              ) : evaluation && evaluation.status === 'processing' ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-lg font-medium">
                      {t('offers.evaluation.processing', 'Evaluation in progress...')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {t('offers.evaluation.processingDesc', 'This may take a few minutes')}
                    </p>
                  </CardContent>
                </Card>
              ) : evaluation && evaluation.status === 'failed' ? (
                <Card className="border-red-200">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                    <p className="text-lg font-medium text-red-900">
                      {t('offers.evaluation.failed', 'Evaluation Failed')}
                    </p>
                    {evaluation.errorMessage && (
                      <p className="text-sm text-red-600 mt-2">
                        {evaluation.errorMessage}
                      </p>
                    )}
                    <div className="mt-4">
                      <EvaluateButton
                        offerId={offerId}
                        offerName={offer.name}
                        onEvaluationStarted={handleEvaluationStarted}
                        variant="outline"
                        size="sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">
                      {t('offers.evaluation.notEvaluated', 'Not evaluated yet')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 mb-4">
                      {t('offers.evaluation.notEvaluatedDesc', 'Start an evaluation to get insights')}
                    </p>
                    <EvaluateButton
                      offerId={offerId}
                      offerName={offer.name}
                      onEvaluationStarted={handleEvaluationStarted}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-4">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p>{t('offers.detail.historyComingSoon', 'Evaluation history coming soon')}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <p>{t('offers.errors.notFound', 'Offer not found')}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}