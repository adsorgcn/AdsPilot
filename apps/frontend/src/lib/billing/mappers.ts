import type { RawTokenBalance, TokenBalance } from './types';

export function mapTokenBalance(balance: RawTokenBalance): TokenBalance {
  const currentBalance =
    balance.current_balance ??
    balance.currentBalance ??
    balance.balance ??
    balance.total_balance ??
    balance.totalBalance ??
    0;

  const totalBalance =
    balance.total_balance ??
    balance.totalBalance ??
    currentBalance;

  const totalGranted =
    balance.total_granted ??
    balance.totalGranted ??
    totalBalance;

  const todayConsumed =
    balance.today_consumed ??
    balance.todayConsumed ??
    balance.totalConsumed ??
    0;

  const thisMonthConsumed =
    balance.this_month_consumed ??
    balance.monthConsumed ??
    0;

  const pendingTasksCount =
    balance.pending_tasks_count ??
    balance.pendingTasks ??
    0;

  const estimatedCostForPending =
    balance.estimated_cost_for_pending ??
    balance.estimatedCostForPending ??
    0;

  const lastUpdated =
    balance.last_updated ??
    balance.updated_at ??
    new Date().toISOString();

  return {
    currentBalance,
    totalConsumed: todayConsumed,
    totalGranted,
    lastUpdated,
    balance: currentBalance,
    totalBalance,
    todayConsumed,
    thisMonthConsumed,
    pendingTasksCount,
    estimatedCostForPending,
  };
}
