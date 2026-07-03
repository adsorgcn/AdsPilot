'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, XCircle, Clock, Sparkles } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import Progress from '~/core/ui/Progress';
import { Alert, AlertDescription, AlertTitle } from '~/core/ui/Alert';
import { useEvaluationProgress } from '~/lib/hooks/useEvaluationProgress';

interface EvaluationProgressDialogProps {
  evaluationId: string | null;
  open: boolean;
  onClose: () => void;
  onCompleted?: (evaluationId: string) => void;
}

/**
 * FE-028: EvaluationProgressDialog component
 * Displays real-time progress of offer evaluation using polling
 */
export function EvaluationProgressDialog({
  evaluationId,
  open,
  onClose,
  onCompleted,
}: EvaluationProgressDialogProps) {
  const { t } = useTranslation('common');

  const { evaluation, isPolling, error } = useEvaluationProgress({
    evaluationId,
    enabled: open && !!evaluationId,
    pollingInterval: 3000, // Poll every 3 seconds
    onCompleted: (ev) => {
      if (onCompleted) {
        onCompleted(ev.id);
      }
    },
  });

  // Auto-close dialog after 2 seconds when completed
  useEffect(() => {
    if (evaluation?.status === 'completed') {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [evaluation?.status, onClose]);

  const getStatusIcon = () => {
    switch (evaluation?.status) {
      case 'pending':
        return <Clock className="h-8 w-8 text-yellow-500 animate-pulse" />;
      case 'processing':
        return <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'failed':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default:
        return <Sparkles className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (evaluation?.status) {
      case 'pending':
        return t('offers.evaluation.progress.pending', 'Queued for evaluation...');
      case 'processing':
        return t('offers.evaluation.progress.processing', 'Analyzing offer data...');
      case 'completed':
        return t('offers.evaluation.progress.completed', 'Evaluation completed successfully!');
      case 'failed':
        return t('offers.evaluation.progress.failed', 'Evaluation failed');
      default:
        return t('offers.evaluation.progress.initializing', 'Initializing...');
    }
  };

  const getProgress = () => {
    switch (evaluation?.status) {
      case 'pending':
        return 25;
      case 'processing':
        return 60;
      case 'completed':
        return 100;
      case 'failed':
        return 100;
      default:
        return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('offers.evaluation.progress.title', 'Evaluation Progress')}
          </DialogTitle>
          <DialogDescription>
            {t('offers.evaluation.progress.description', 'Tracking evaluation status in real-time')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Status Icon */}
          <div className="flex flex-col items-center gap-4">
            {getStatusIcon()}
            <div className="text-center">
              <p className="font-medium">{getStatusText()}</p>
              {evaluation?.evaluationType && (
                <p className="text-xs text-muted-foreground mt-1">
                  {evaluation.evaluationType === 'ai'
                    ? t('offers.evaluation.type.ai', 'AI-Enhanced Analysis')
                    : t('offers.evaluation.type.basic', 'Basic Analysis')}
                </p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {isPolling && evaluation?.status !== 'completed' && evaluation?.status !== 'failed' && (
            <div className="space-y-2">
              <Progress value={getProgress()} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {t('offers.evaluation.progress.estimatedTime', 'Estimated time: 30-60 seconds')}
              </p>
            </div>
          )}

          {/* Error Message */}
          {(error || evaluation?.status === 'failed') && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>{t('offers.evaluation.error.title', 'Evaluation Error')}</AlertTitle>
              <AlertDescription>
                {evaluation?.errorMessage || error || t('offers.evaluation.error.unknown', 'An unknown error occurred')}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Info */}
          {evaluation?.status === 'completed' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>{t('offers.evaluation.success.title', 'Success!')}</AlertTitle>
              <AlertDescription>
                {evaluation.tokensConsumed && (
                  <span>
                    {t('offers.evaluation.success.tokensUsed', 'Tokens used')}: {evaluation.tokensConsumed}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2">
          {evaluation?.status === 'completed' || evaluation?.status === 'failed' ? (
            <Button onClick={onClose}>
              {t('common.close', 'Close')}
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              {t('offers.evaluation.progress.backgroundMode', 'Run in Background')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
