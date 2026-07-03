'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

import { GlassCard } from '~/components/ui/GlassCard';
import { ProgressRing } from '~/components/ui/ProgressRing';
import { GradientButton } from '~/components/ui/GradientButton';
import { AnimatedEvaluationCard } from './AnimatedEvaluationCard';

interface EvaluationStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp?: string;
}

interface EvaluationResult {
  overallScore: number;
  aiScore?: number;
  basicScore?: number;
  brandName?: string;
  domain?: string;
  finalUrl?: string;
  metrics: {
    traffic: number;
    engagement: number;
    authority: number;
    conversion: number;
  };
  recommendation: string;
  insights: string[];
}

export interface EvaluationCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  offerUrl: string;
  onComplete?: (result: EvaluationResult) => void;
}

export function EvaluationCardModal({
  open,
  onOpenChange,
  onComplete,
}: EvaluationCardModalProps) {
  const { t } = useTranslation('common');
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [steps, setSteps] = React.useState<EvaluationStep[]>([
    { id: 'fetch', label: t('evaluation.steps.fetchUrl', 'Fetching Offer URL'), status: 'pending' },
    { id: 'extract', label: t('evaluation.steps.extractInfo', 'Extracting Landing Page Info'), status: 'pending' },
    { id: 'similarweb', label: t('evaluation.steps.querySimilarWeb', 'Querying SimilarWeb API'), status: 'pending' },
    { id: 'analyze', label: t('evaluation.steps.analyzing', 'Analyzing Data'), status: 'pending' },
    { id: 'ai', label: t('evaluation.steps.aiEvaluation', 'AI Deep Evaluation'), status: 'pending' },
  ]);
  const [result, setResult] = React.useState<EvaluationResult | null>(null);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (open) {
      startEvaluation();
    } else {
      // Reset state when modal closes
      setIsFlipped(false);
      setProgress(0);
      setResult(null);
      setSteps(steps.map(s => ({ ...s, status: 'pending' })));
    }
  }, [open]);

  const startEvaluation = async () => {
    // Simulate evaluation process
    const stepDurations = [1000, 1500, 2000, 1500, 2000];
    
    for (let i = 0; i < steps.length; i++) {
      setSteps(prev => 
        prev.map((step, idx) => 
          idx === i ? { ...step, status: 'running' } : step
        )
      );
      setProgress(((i + 0.5) / steps.length) * 100);

      await new Promise(resolve => setTimeout(resolve, stepDurations[i]));

      setSteps(prev =>
        prev.map((step, idx) =>
          idx === i ? { ...step, status: 'completed', timestamp: new Date().toISOString() } : step
        )
      );
      setProgress(((i + 1) / steps.length) * 100);
    }

    // Simulate result
    const mockResult: EvaluationResult = {
      overallScore: 85,
      aiScore: 88,
      basicScore: 82,
      brandName: 'YitaHome',
      domain: 'yitahome.com',
      finalUrl: 'https://www.yitahome.com/',
      metrics: {
        traffic: 78,
        engagement: 85,
        authority: 72,
        conversion: 90,
      },
      recommendation: t('evaluation.result.highPotential', 'High potential offer with strong engagement metrics'),
      insights: [
        t('evaluation.insights.traffic', 'Strong organic traffic growth'),
        t('evaluation.insights.engagement', 'Above average user engagement'),
        t('evaluation.insights.conversion', 'Excellent conversion rate potential'),
      ],
    };

    setResult(mockResult);
    
    // Flip card after a short delay
    setTimeout(() => {
      setIsFlipped(true);
    }, 500);

    if (onComplete) {
      onComplete(mockResult);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2">
          <div className="relative" style={{ perspective: '1000px' }}>
            <AnimatePresence mode="wait">
              {!isFlipped ? (
                <motion.div
                  key="front"
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: 0 }}
                  exit={{ rotateY: 90 }}
                  transition={{ duration: 0.3 }}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <GlassCard variant="gradient" className="p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                          <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">
                            {t('evaluation.title', 'Evaluating Offer')}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {t('evaluation.subtitle', 'Please wait while we analyze...')}
                          </p>
                        </div>
                      </div>
                      <Dialog.Close asChild>
                        <button className="rounded-full p-2 hover:bg-gray-100">
                          <X className="h-5 w-5" />
                        </button>
                      </Dialog.Close>
                    </div>

                    <div className="mb-6 flex justify-center">
                      <ProgressRing
                        value={progress}
                        max={100}
                        size="xl"
                        color="primary"
                      />
                    </div>

                    <div className="space-y-3">
                      {steps.map((step) => (
                        <div
                          key={step.id}
                          className="flex items-center gap-3 rounded-lg bg-white/50 p-3"
                        >
                          {step.status === 'completed' && (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          )}
                          {step.status === 'running' && (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          )}
                          {step.status === 'failed' && (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          {step.status === 'pending' && (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                          )}
                          <span className={`flex-1 text-sm ${
                            step.status === 'completed' ? 'text-gray-600' : 'font-medium'
                          }`}>
                            {step.label}
                          </span>
                          {step.timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(step.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              ) : (
                <motion.div
                  key="back"
                  initial={{ rotateY: -90 }}
                  animate={{ rotateY: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="relative">
                    <Dialog.Close asChild>
                      <button className="absolute right-4 top-4 z-10 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
                        <X className="h-5 w-5" />
                      </button>
                    </Dialog.Close>
                    
                    {result && (
                      <AnimatedEvaluationCard
                        overallScore={result.overallScore}
                        metrics={result.metrics}
                        recommendation={result.recommendation}
                        insights={result.insights}
                        brandName={result.brandName}
                        animate={true}
                        delay={0.2}
                      />
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex gap-3">
                      <GradientButton
                        variant="primary"
                        className="flex-1"
                        onClick={() => onOpenChange(false)}
                      >
                        {t('evaluation.viewDetails', 'View Details')}
                      </GradientButton>
                      <GradientButton
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                      >
                        {t('common.close', 'Close')}
                      </GradientButton>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}