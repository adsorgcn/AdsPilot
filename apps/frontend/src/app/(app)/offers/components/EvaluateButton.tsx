'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoltIcon, PlayIcon } from '@heroicons/react/24/solid';

import Button from '~/core/ui/Button';
import Spinner from '~/core/ui/Spinner';
import useUserSubscription from '~/core/hooks/use-user-subscription';

import type { Offer } from '~/lib/offers';
import { useEvaluateOffer } from '~/lib/offers/hooks';

interface EvaluateButtonProps {
  offer: Offer;
  onSuccess?: () => void;
  disabled?: boolean;
}

/**
 * @name EvaluateButton
 * @description Smart evaluate button that adapts to user's subscription tier
 *
 * - Elite users: AI evaluation (3 tokens, shows lightning icon)
 * - Pro/Max users: Basic evaluation (1 token, shows play icon)
 * - Insufficient tokens: Button disabled with tooltip
 *
 * Ref: frontend-package-offer-evaluation.md - Task A2-2
 */
export function EvaluateButton({
  offer,
  onSuccess,
  disabled,
}: EvaluateButtonProps) {
  const { t } = useTranslation('common');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const { data: subscription, isLoading: isLoadingSubscription } =
    useUserSubscription();
  const evaluateOffer = useEvaluateOffer();

  // Calculate token requirements
  const isElite = subscription && 'isElite' in subscription ? subscription.isElite : false;
  const tokenCost = isElite ? 3 : 1;
  const currentBalance = subscription && 'currentTokenBalance' in subscription ? subscription.currentTokenBalance : 0;
  const canAfford = currentBalance >= tokenCost;

  // Determine button state
  const isDisabled =
    disabled || isEvaluating || isLoadingSubscription || !canAfford;

  const handleEvaluate = async () => {
    if (isDisabled) {
      return;
    }

    setIsEvaluating(true);

    // Log evaluation attempt (Ref: Task A3-5)
    const startTime = Date.now();
    // 开发环境才记录详细日志
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Evaluate] Starting evaluation', {
        offerId: offer.id,
        offerUrl: offer.url,
        enableAI: isElite,
        tokenCost,
        userTier: subscription && 'tier' in subscription ? subscription.tier : undefined,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const result = await evaluateOffer(offer.id, {
        enableAI: isElite,
        forceRefresh: false,
      });

      const duration = Date.now() - startTime;

      // Log success (Ref: Task A3-5)
      console.log('[Evaluate] Evaluation started successfully', {
        offerId: offer.id,
        evaluationId: result.evaluationId,
        status: result.status,
        tokenCost: result.tokenCost,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      // Show success toast notification
      // Note: Toast implementation commented out - can be enabled when toast system is ready
      // toast.success(`评估已启动 (消耗 ${result.tokenCost} Token)`);

      onSuccess?.();
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error (Ref: Task A3-5)
      console.error('[Evaluate] Evaluation failed', {
        offerId: offer.id,
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      // Show error toast notification
      // Note: Toast implementation commented out - can be enabled when toast system is ready
      // toast.error(error instanceof Error ? error.message : '评估失败，请稍后重试');

      alert(
        error instanceof Error
          ? error.message
          : 'Evaluation failed. Please try again.',
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  // Button text logic
  let buttonText = t('offers.evaluate.button');
  if (isEvaluating) {
    buttonText = t('offers.evaluate.evaluating');
  } else if (!canAfford) {
    buttonText = t('offers.evaluate.insufficientTokens');
  } else if (isElite) {
    buttonText = t('offers.evaluate.aiEvaluate', { cost: tokenCost });
  } else {
    buttonText = t('offers.evaluate.basicEvaluate', { cost: tokenCost });
  }

  // Icon selection
  const IconComponent = isElite ? BoltIcon : PlayIcon;

  const tooltipTitle = !canAfford
    ? t('offers.evaluate.insufficientTokensTooltip', { required: tokenCost, current: currentBalance })
    : isElite
      ? t('offers.evaluate.aiEvaluateTooltip')
      : t('offers.evaluate.basicEvaluateTooltip');

  return (
    <Button
      size={'sm'}
      variant={isElite ? 'default' : 'outline'}
      onClick={handleEvaluate}
      disabled={isDisabled}
      title={tooltipTitle}
    >
      {isEvaluating ? (
        <Spinner className={'mr-1 h-4 w-4'} />
      ) : (
        <IconComponent className={'mr-1 h-4 w-4'} />
      )}
      {buttonText}
    </Button>
  );
}

export default EvaluateButton;
