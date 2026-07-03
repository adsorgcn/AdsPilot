'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, AlertCircle, Coins } from 'lucide-react';
import { toast } from 'sonner';

import Button from '~/core/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/core/ui/Dialog';
import { Checkbox } from '~/core/ui/Checkbox';
import { Alert, AlertDescription, AlertTitle } from '~/core/ui/Alert';
import { useSubscription, useTokenBalance } from '~/lib/hooks/useSubscription';
import useSupabase from '~/core/hooks/use-supabase';

interface EvaluateButtonProps {
  offerId: string;
  offerName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  onEvaluationStarted?: (evaluationId: string) => void;
}

/**
 * FE-020: EvaluateButton component with AI toggle and token display
 * FE-021: Integrated with subscription permission checks
 * FE-022: Shows token consumption (1 for basic, 3 for AI)
 */
export function EvaluateButton({
  offerId,
  offerName,
  variant = 'default',
  size = 'default',
  onEvaluationStarted,
}: EvaluateButtonProps) {
  const { t } = useTranslation('common');
  const client = useSupabase();
  const { subscription, canUseAI, isStarter } = useSubscription();
  const { balance, mutate: refreshBalance } = useTokenBalance();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [enableAI, setEnableAI] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Calculate tokens required
  const tokensRequired = enableAI ? 3 : 1;
  const hasEnoughTokens = (balance?.available || 0) >= tokensRequired;

  const handleEvaluate = async () => {
    if (!hasEnoughTokens) {
      toast.error(t('offers.evaluation.insufficientTokens', 'Insufficient tokens'));
      return;
    }

    if (enableAI && !canUseAI) {
      toast.error(t('offers.evaluation.aiRequiresPlan', 'AI evaluation requires Professional or Elite plan'));
      return;
    }

    setIsEvaluating(true);

    try {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const apiBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseURL) {
        throw new Error('API Gateway URL not configured');
      }

      const response = await fetch(`${apiBaseURL}/api/v1/offers/${offerId}/evaluate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `eval-${offerId}-${Date.now()}`,
        },
        body: JSON.stringify({
          enableAI,
          forceRefresh: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Evaluation failed');
      }

      const result = await response.json();

      toast.success(t('offers.evaluation.started', 'Evaluation started successfully'));

      // Refresh token balance
      refreshBalance();

      // Close dialog
      setIsDialogOpen(false);

      // Notify parent
      if (onEvaluationStarted) {
        onEvaluationStarted(result.evaluationId);
      }
    } catch (error: any) {
      console.error('Evaluation error:', error);
      toast.error(error.message || t('offers.evaluation.failed', 'Evaluation failed'));
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsDialogOpen(true)}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {t('offers.actions.evaluate', 'Evaluate')}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('offers.evaluation.title', 'Evaluate Offer')}
            </DialogTitle>
            <DialogDescription>
              {offerName || t('offers.evaluation.description', 'Analyze this offer to get traffic insights and recommendations')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Token cost display */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">
                  {t('offers.evaluation.tokenCost', 'Token Cost')}
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{tokensRequired} {t('common.tokens', 'tokens')}</div>
                <div className="text-xs text-muted-foreground">
                  {t('offers.evaluation.available', 'Available')}: {balance?.available || 0}
                </div>
              </div>
            </div>

            {/* AI toggle */}
            {canUseAI && (
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id="enable-ai"
                  checked={enableAI}
                  onCheckedChange={(checked) => setEnableAI(checked as boolean)}
                />
                <div className="flex-1">
                  <label
                    htmlFor="enable-ai"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {t('offers.evaluation.enableAI', 'Enable AI Analysis')}
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('offers.evaluation.aiDescription', 'Get AI-powered recommendations and detailed insights (3 tokens)')}
                  </p>
                </div>
              </div>
            )}

            {/* Upgrade prompt for Starter users */}
            {isStarter && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('offers.evaluation.upgradeTitle', 'Upgrade for AI Analysis')}</AlertTitle>
                <AlertDescription>
                  {t('offers.evaluation.upgradeDescription', 'AI evaluation requires Professional or Elite plan.')}
                  {' '}
                  <a href="/settings/subscription" className="underline font-medium">
                    {t('offers.evaluation.viewPlans', 'View plans')}
                  </a>
                </AlertDescription>
              </Alert>
            )}

            {/* Insufficient tokens warning */}
            {!hasEnoughTokens && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('offers.evaluation.insufficientTitle', 'Insufficient Tokens')}</AlertTitle>
                <AlertDescription>
                  {t('offers.evaluation.insufficientDescription', 'You need {required} tokens to evaluate this offer.', { required: tokensRequired })}
                  {' '}
                  <a href="/settings/subscription" className="underline font-medium">
                    {t('offers.evaluation.getTokens', 'Get more tokens')}
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isEvaluating}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleEvaluate}
              disabled={isEvaluating || !hasEnoughTokens}
              className="gap-2"
            >
              {isEvaluating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEvaluating
                ? t('offers.evaluation.evaluating', 'Evaluating...')
                : t('offers.evaluation.start', 'Start Evaluation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
