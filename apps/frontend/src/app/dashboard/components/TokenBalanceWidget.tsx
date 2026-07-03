'use client';

import { BoltIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

import useUserSubscription from '~/core/hooks/use-user-subscription';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

interface TokenBalanceWidgetProps {
  collapsed?: boolean;
}

/**
 * @name TokenBalanceWidget
 * @description Displays user's token balance in the sidebar
 *
 * Shows:
 * - Current token balance
 * - Monthly allocation
 * - Subscription tier indicator (Elite with lightning icon)
 *
 * Ref: frontend-package-offer-evaluation.md - Task A2-4
 */
export function TokenBalanceWidget({ collapsed }: TokenBalanceWidgetProps) {
  const { data: subscription, isLoading, mutate } = useUserSubscription();

  if (isLoading || !subscription) {
    return null;
  }

  const {
    currentTokenBalance,
    monthlyTokenAllocation,
    isElite,
    tier,
    isActive,
  } = subscription;

  const percentage = Math.min(
    (currentTokenBalance / monthlyTokenAllocation) * 100,
    100,
  );

  // Color based on remaining percentage
  const getBalanceColor = (): string => {
    if (percentage >= 50) return 'text-green-600';
    if (percentage >= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressBarColor = (): string => {
    if (percentage >= 50) return 'bg-green-600';
    if (percentage >= 20) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={
              'flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/50'
            }
          >
            <div className={'relative'}>
              <BoltIcon
                className={`h-5 w-5 ${isElite ? 'text-primary' : 'text-muted-foreground'}`}
              />
              {isElite && (
                <CheckCircleIcon
                  className={
                    'absolute -right-1 -top-1 h-3 w-3 text-green-600'
                  }
                />
              )}
            </div>
          </div>
        </TooltipTrigger>

        <TooltipContent side={'right'} sideOffset={10}>
          <div className={'flex flex-col gap-1 text-xs'}>
            <div className={'font-semibold'}>Token 余额</div>
            <div>
              剩余: <span className={getBalanceColor()}>{currentTokenBalance}</span> / {monthlyTokenAllocation}
            </div>
            <div className={'text-muted-foreground'}>
              套餐: {getTierLabel(tier)}
              {isElite && ' ⚡'}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      className={
        'mb-3 rounded-lg border border-border bg-background p-3 transition-colors'
      }
    >
      <div className={'mb-2 flex items-center justify-between'}>
        <div className={'flex items-center gap-2'}>
          <BoltIcon
            className={`h-4 w-4 ${isElite ? 'text-primary' : 'text-muted-foreground'}`}
          />
          <span className={'text-xs font-medium text-foreground'}>
            Token 余额
          </span>
        </div>

        <button
          type={'button'}
          onClick={() => mutate()}
          className={'text-muted-foreground hover:text-foreground'}
          aria-label={'刷新 Token 余额'}
        >
          <ArrowPathIcon className={'h-3.5 w-3.5'} />
        </button>
      </div>

      <div className={'mb-1.5 flex items-baseline gap-1'}>
        <span className={`text-2xl font-bold ${getBalanceColor()}`}>
          {currentTokenBalance.toLocaleString()}
        </span>
        <span className={'text-xs text-muted-foreground'}>
          / {monthlyTokenAllocation.toLocaleString()}
        </span>
      </div>

      <div className={'mb-2 h-1.5 overflow-hidden rounded-full bg-muted'}>
        <div
          className={`h-full transition-all ${getProgressBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className={'flex items-center justify-between text-xs'}>
        <span className={'text-muted-foreground'}>
          {getTierLabel(tier)}
          {isElite && ' ⚡'}
        </span>

        {!isActive && (
          <span className={'text-red-600 font-medium'}>已过期</span>
        )}
      </div>
    </div>
  );
}

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    trial: '试用版',
    pro: 'Pro',
    max: 'Max',
    elite: 'Elite',
  };
  return labels[tier] || tier;
}

export default TokenBalanceWidget;
