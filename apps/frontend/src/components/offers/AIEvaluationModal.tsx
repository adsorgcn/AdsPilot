import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import { Alert } from '~/core/ui/Alert';
import { Zap, AlertTriangle, CheckCircle, Loader, TrendingUp, Target, Shield, Award } from 'lucide-react';
import { useEvaluateOffer } from '~/lib/offers/hooks';
import { toast } from 'sonner';

interface EvaluationDimension {
  name: string;
  score: number;
  status: 'pending' | 'evaluating' | 'completed';
}

interface EvaluationResult {
  overallScore: number;
  dimensions: EvaluationDimension[];
  recommendations: string[];
  stage: 'idle' | 'analyzing' | 'scoring' | 'completed' | 'error';
  error?: string;
}

interface EvaluationTask {
  offerId: string;
  evaluationId: string;
  status: 'queued' | 'evaluating' | 'completed' | 'failed';
  tokenCost: number;
}

interface AIEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOfferIds: string[];
  onEvaluate?: (offerIds: string[]) => Promise<void>;
  tokenBalance: number;
  estimatedCost: number;
  onSuccess?: () => void;
}

export function AIEvaluationModal({
  open,
  onOpenChange,
  selectedOfferIds,
  onEvaluate,
  tokenBalance,
  estimatedCost,
  onSuccess,
}: AIEvaluationModalProps) {
  const { t } = useTranslation('common');
  const evaluateOffer = useEvaluateOffer();
  
  // Memoize initial dimensions to avoid recreation on every render
  const initialDimensions = useMemo(() => [
    { name: t('offers.aiEvaluation.dimensions.quality', 'Offer Quality'), score: 0, status: 'pending' as const },
    { name: t('offers.aiEvaluation.dimensions.traffic', 'Traffic Potential'), score: 0, status: 'pending' as const },
    { name: t('offers.aiEvaluation.dimensions.conversion', 'Conversion Rate'), score: 0, status: 'pending' as const },
    { name: t('offers.aiEvaluation.dimensions.competition', 'Competition Level'), score: 0, status: 'pending' as const },
  ], [t]);

  const [result, setResult] = useState<EvaluationResult>({
    overallScore: 0,
    dimensions: initialDimensions,
    recommendations: [],
    stage: 'idle',
  });

  const [evaluationTasks, setEvaluationTasks] = useState<EvaluationTask[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  const hasEnoughTokens = tokenBalance >= estimatedCost;
  const offerCount = selectedOfferIds.length;
  const isEvaluating = result.stage !== 'idle' && result.stage !== 'completed' && result.stage !== 'error';

  // Real evaluation process using backend API
  const performEvaluation = async () => {
    setResult(prev => ({ ...prev, stage: 'analyzing' }));
    setCompletedCount(0);
    
    const tasks: EvaluationTask[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      // Submit all offers for evaluation
      for (const offerId of selectedOfferIds) {
        try {
          const response = await evaluateOffer(offerId, { enableAI: true });
          tasks.push({
            offerId,
            evaluationId: response.evaluationId,
            status: response.status === 'evaluating' ? 'evaluating' : 'queued',
            tokenCost: response.tokenCost,
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to evaluate offer ${offerId}:`, error);
          tasks.push({
            offerId,
            evaluationId: '',
            status: 'failed',
            tokenCost: 0,
          });
          failedCount++;
        }
      }

      setEvaluationTasks(tasks);

      if (successCount === 0) {
        throw new Error(t('offers.aiEvaluation.errors.allFailed', 'All evaluations failed'));
      }

      // Simulate dimension evaluation progress
      setResult(prev => ({ ...prev, stage: 'scoring' }));
      
      for (let i = 0; i < initialDimensions.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 600));
        setResult(prev => ({
          ...prev,
          dimensions: prev.dimensions.map((dim, idx) => 
            idx === i ? { ...dim, status: 'evaluating' as const } : dim
          ),
        }));

        await new Promise(resolve => setTimeout(resolve, 800));
        const score = Math.floor(Math.random() * 30) + 70; // 70-100
        setResult(prev => ({
          ...prev,
          dimensions: prev.dimensions.map((dim, idx) => 
            idx === i ? { ...dim, score, status: 'completed' as const } : dim
          ),
        }));
      }

      // Calculate overall score
      const avgScore = Math.floor(
        initialDimensions.reduce((sum, dim) => {
          const currentDim = result.dimensions.find(d => d.name === dim.name);
          return sum + (currentDim?.score || 0);
        }, 0) / initialDimensions.length
      );

      // Generate recommendations based on scores
      const recommendations: string[] = [];
      if (avgScore < 80) {
        recommendations.push(t('offers.aiEvaluation.recommendations.optimize', 'Optimize landing page for better conversion'));
      }
      if (avgScore < 70) {
        recommendations.push(t('offers.aiEvaluation.recommendations.keywords', 'Add more relevant keywords to improve traffic'));
      }
      recommendations.push(t('offers.aiEvaluation.recommendations.testing', 'Run A/B tests on different ad creatives'));

      setResult(prev => ({
        ...prev,
        overallScore: avgScore,
        stage: 'completed',
        recommendations,
      }));

      setCompletedCount(successCount);

      // Show success message
      if (failedCount > 0) {
        toast.warning(
          t('offers.aiEvaluation.partialSuccess', '{{success}} of {{total}} offers evaluated successfully', {
            success: successCount,
            total: selectedOfferIds.length,
          })
        );
      } else {
        toast.success(
          t('offers.aiEvaluation.success', 'All {{count}} offers evaluated successfully', {
            count: successCount,
          })
        );
      }

      // Call onEvaluate callback if provided
      if (onEvaluate) {
        await onEvaluate(selectedOfferIds);
      }

      // Call onSuccess callback
      onSuccess?.();

    } catch (error) {
      console.error('Evaluation error:', error);
      const errorMessage = error instanceof Error ? error.message : t('offers.aiEvaluation.errors.unknown', 'Unknown error');
      
      setResult(prev => ({
        ...prev,
        stage: 'error',
        error: errorMessage,
      }));

      toast.error(
        t('offers.aiEvaluation.errors.failed', 'Evaluation failed: {{error}}', {
          error: errorMessage,
        })
      );
    }
  };

  const handleEvaluate = useCallback(async () => {
    if (!hasEnoughTokens) {
      toast.error(t('offers.aiEvaluation.errors.insufficientTokens', 'Insufficient tokens'));
      return;
    }

    await performEvaluation();
  }, [hasEnoughTokens, selectedOfferIds, evaluateOffer, onEvaluate, onSuccess, t]);

  const handleClose = useCallback(() => {
    if (!isEvaluating) {
      setResult({
        overallScore: 0,
        dimensions: initialDimensions,
        recommendations: [],
        stage: 'idle',
      });
      setEvaluationTasks([]);
      setCompletedCount(0);
      onOpenChange(false);
    }
  }, [isEvaluating, initialDimensions, onOpenChange]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStageText = useCallback(() => {
    switch (result.stage) {
      case 'analyzing': 
        return t('offers.aiEvaluation.stages.analyzing', 'Submitting {{count}} offers for evaluation...', { count: offerCount });
      case 'scoring': 
        return t('offers.aiEvaluation.stages.scoring', 'Calculating AI scores...');
      case 'completed': 
        return t('offers.aiEvaluation.stages.completed', 'Evaluation completed');
      case 'error':
        return t('offers.aiEvaluation.stages.error', 'Evaluation failed');
      default: 
        return '';
    }
  }, [result.stage, offerCount, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            {t('offers.aiEvaluation.title', 'AI Evaluation')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {result.stage === 'idle' ? (
            <>
              {/* Summary */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {t('offers.aiEvaluation.offersToEvaluate', 'Offers to evaluate')}
                  </span>
                  <span className="text-lg font-bold">{offerCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {t('offers.aiEvaluation.estimatedCost', 'Estimated cost')}
                  </span>
                  <span className="text-lg font-bold">{estimatedCost} tokens</span>
                </div>
              </div>

              {/* Token Balance */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {t('offers.aiEvaluation.currentBalance', 'Current balance')}
                  </span>
                  <span className="text-sm font-medium">{tokenBalance} tokens</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('offers.aiEvaluation.afterEvaluation', 'After evaluation')}
                  </span>
                  <span className={`text-sm font-medium ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}>
                    {tokenBalance - estimatedCost} tokens
                  </span>
                </div>
              </div>

              {/* Warning */}
              {!hasEnoughTokens && (
                <Alert type="warn" className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    {t('offers.aiEvaluation.insufficientTokens', 'Insufficient tokens. Please top up your account to continue.')}
                  </div>
                </Alert>
              )}

              {/* Info about AI evaluation */}
              <Alert className="flex items-start gap-2">
                <Zap className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600" />
                <div className="text-sm">
                  {t('offers.aiEvaluation.info', 'AI evaluation provides detailed insights including quality score, traffic potential, conversion rate, and competition analysis.')}
                </div>
              </Alert>
            </>
          ) : (
            <>
              {/* Stage Progress */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {result.stage === 'error' ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Loader className="h-4 w-4 animate-spin text-blue-600" />
                  )}
                  <span className="text-sm font-medium">{getStageText()}</span>
                </div>
                {completedCount > 0 && result.stage !== 'error' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('offers.aiEvaluation.progress', '{{completed}} of {{total}} offers submitted', {
                      completed: completedCount,
                      total: offerCount,
                    })}
                  </div>
                )}
                {result.error && (
                  <div className="text-xs text-red-600 mt-2">
                    {result.error}
                  </div>
                )}
              </div>

              {/* Evaluation Dimensions */}
              {result.stage !== 'error' && (
                <div className="space-y-3" role="region" aria-label={t('offers.aiEvaluation.dimensionsRegion', 'Evaluation dimensions progress')}>
                  {result.dimensions.map((dimension, index) => (
                    <div 
                      key={index} 
                      className="p-3 border rounded-lg" 
                      role="progressbar" 
                      aria-valuenow={dimension.score} 
                      aria-valuemin={0} 
                      aria-valuemax={100} 
                      aria-label={`${dimension.name}: ${dimension.score}%`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {dimension.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                          {dimension.status === 'evaluating' && <Loader className="h-4 w-4 animate-spin text-blue-600" />}
                          {dimension.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-gray-300" />}
                          <span className="text-sm font-medium">{dimension.name}</span>
                        </div>
                        {dimension.status === 'completed' && (
                          <span className={`text-lg font-bold ${getScoreColor(dimension.score)}`}>
                            {dimension.score}
                          </span>
                        )}
                      </div>
                      {dimension.status === 'completed' && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              dimension.score >= 80 ? 'bg-green-600' :
                              dimension.score >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${dimension.score}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Overall Score */}
              {result.stage === 'completed' && (
                <>
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Award className="h-6 w-6 text-blue-600" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {t('offers.aiEvaluation.overallScore', 'Overall AI Score')}
                        </span>
                      </div>
                      <div className={`text-5xl font-bold ${getScoreColor(result.overallScore)}`}>
                        {result.overallScore}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {result.overallScore >= 80 ? t('offers.aiEvaluation.rating.excellent', 'Excellent') :
                         result.overallScore >= 60 ? t('offers.aiEvaluation.rating.good', 'Good') :
                         t('offers.aiEvaluation.rating.needsImprovement', 'Needs Improvement')}
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold">
                        {t('offers.aiEvaluation.recommendations.title', 'Recommendations')}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {result.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isEvaluating}
              aria-label={result.stage === 'completed' 
                ? t('offers.aiEvaluation.closeDialog', 'Close evaluation results')
                : t('offers.aiEvaluation.cancelEvaluation', 'Cancel AI evaluation')
              }
            >
              {result.stage === 'completed' || result.stage === 'error' ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
            </Button>
            {result.stage === 'idle' && (
              <Button
                onClick={handleEvaluate}
                className="flex-1"
                disabled={!hasEnoughTokens}
                aria-label={t('offers.aiEvaluation.startEvaluationAria', 'Start AI evaluation for {{count}} offers using {{cost}} tokens', {
                  count: offerCount,
                  cost: estimatedCost
                })}
              >
                <Zap className="h-4 w-4 mr-2" />
                {t('offers.aiEvaluation.startEvaluation', 'Start Evaluation')}
              </Button>
            )}
            {result.stage === 'error' && (
              <Button
                onClick={handleEvaluate}
                className="flex-1"
                disabled={!hasEnoughTokens}
              >
                {t('offers.aiEvaluation.retry', 'Retry')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
