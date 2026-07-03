'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Badge from '~/core/ui/Badge';
import { Star, Sparkles, RotateCcw } from 'lucide-react';
import Button from '~/core/ui/Button';

interface EvaluationScores {
  basic?: {
    score: number; // 0-100
    grade: string; // e.g., "B+"
    factors: {
      label: string;
      value: number;
      weight: number;
    }[];
    completedAt: string;
  };
  ai?: {
    score: number; // 0-100
    grade: string; // e.g., "A-"
    recommendation: string;
    confidence: number; // 0-1
    factors: {
      label: string;
      value: number;
      impact: 'positive' | 'negative' | 'neutral';
    }[];
    completedAt: string;
  };
}

interface EvaluationScoreCardProps {
  scores: EvaluationScores;
  offerId: string;
  onReEvaluate?: () => void;
  className?: string;
}

/**
 * Flip card showing basic and AI evaluation scores
 * Design reference: design.md lines 1902-1907
 */
export function EvaluationScoreCard({
  scores,
  offerId,
  onReEvaluate,
  className = '',
}: EvaluationScoreCardProps) {
  const { t } = useTranslation();
  const [showAI, setShowAI] = useState(false);

  const hasBasic = !!scores.basic;
  const hasAI = !!scores.ai;

  if (!hasBasic && !hasAI) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">{t('offers.evaluation.notEvaluated', 'Not evaluated yet')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ perspective: '1000px' }}>
      <div
        className={`relative transition-all duration-500 transform-style-3d ${
          showAI ? 'rotate-y-180' : ''
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: showAI ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front: Basic Score */}
        <Card
          className="absolute inset-0 backface-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600" />
                {t('offers.evaluation.basicScore', 'Basic Evaluation')}
              </CardTitle>
              {hasAI && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAI(true)}
                  className="gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  {t('offers.evaluation.viewAI', 'View AI Score')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasBasic ? (
              <>
                {/* Score Display */}
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-blue-600 mb-2">
                      {scores.basic!.grade}
                    </div>
                    <Badge variant="secondary" className="text-lg px-4 py-1">
                      {scores.basic!.score}/100
                    </Badge>
                  </div>
                </div>

                {/* Factors Breakdown */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('offers.evaluation.factors', 'Evaluation Factors')}
                  </p>
                  {scores.basic!.factors.map((factor, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{factor.label}</span>
                        <span className="font-medium">{factor.value}/10</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${(factor.value / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Metadata */}
                <p className="text-xs text-muted-foreground text-center">
                  {t('offers.evaluation.evaluatedAt', 'Evaluated at')}{' '}
                  {new Date(scores.basic!.completedAt).toLocaleString()}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                {t('offers.evaluation.noBasicScore', 'No basic evaluation available')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Back: AI Score */}
        {hasAI && (
          <Card
            className="absolute inset-0"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  {t('offers.evaluation.aiScore', 'AI Evaluation')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAI(false)}
                  className="gap-1"
                >
                  <Star className="h-4 w-4" />
                  {t('offers.evaluation.viewBasic', 'View Basic')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Score Display */}
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl font-bold text-purple-600 mb-2">
                    {scores.ai!.grade}
                  </div>
                  <Badge className="text-lg px-4 py-1 bg-purple-100 text-purple-800">
                    {scores.ai!.score}/100
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('offers.evaluation.confidence', 'Confidence')}:{' '}
                    {Math.round(scores.ai!.confidence * 100)}%
                  </p>
                </div>
              </div>

              {/* AI Recommendation */}
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-900 font-medium mb-1">
                  {t('offers.evaluation.recommendation', 'Recommendation')}
                </p>
                <p className="text-sm text-purple-700">{scores.ai!.recommendation}</p>
              </div>

              {/* AI Factors */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {t('offers.evaluation.aiFactors', 'AI Analysis')}
                </p>
                {scores.ai!.factors.map((factor, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          factor.impact === 'positive'
                            ? 'bg-green-500'
                            : factor.impact === 'negative'
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      {factor.label}
                    </span>
                    <span className="font-medium">{factor.value}/10</span>
                  </div>
                ))}
              </div>

              {/* Metadata */}
              <p className="text-xs text-muted-foreground text-center">
                {t('offers.evaluation.evaluatedAt', 'Evaluated at')}{' '}
                {new Date(scores.ai!.completedAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Re-evaluate Button */}
      {onReEvaluate && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onReEvaluate} className="gap-1">
            <RotateCcw className="h-4 w-4" />
            {t('offers.evaluation.reEvaluate', 'Re-evaluate')}
          </Button>
        </div>
      )}
    </div>
  );
}
