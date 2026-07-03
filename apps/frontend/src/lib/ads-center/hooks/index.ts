/**
 * Ads Center Hooks - 模块化导出
 *
 * 拆分自原 hooks.ts (569行) 为更小的专项模块：
 * - useAdsAccounts: 账号列表查询（SSE实时流）
 * - useAdsAccount: 单个账号详情
 * - useAdsConnection: OAuth授权、同步、断开连接
 * - useAdsMetrics: 策略和执行报告
 * - useAdsBudget: 预算转移
 */

// 账号查询
export { useAdsAccounts } from './useAdsAccounts';
export { useAdsAccount } from './useAdsAccount';

// 连接管理
export {
  useGetOAuthUrl,
  useSyncAccount,
  useSyncAllAccounts,
  useDisconnectAccount,
} from './useAdsConnection';

// 指标和报告
export {
  useAdsStrategies,
  useAdsExecutionReport,
} from './useAdsMetrics';

// 预算管理
export { useTransferBudget } from './useAdsBudget';

// 类型导出
export type * from '../types';
