/**
 * Offers Hooks - 模块化导出
 *
 * 拆分自原 hooks.ts (469行) 为7个专项模块：
 * - useOffersList: 列表查询（分页、筛选、排序）
 * - useOfferDetail: 单个详情查询
 * - useOfferAccounts: 关联账号查询
 * - useOfferHistory: 评估历史查询
 * - useOfferActions: 操作类hooks (创建、删除、收藏、更新状态)
 * - useOfferEvaluation: 评估类hooks (单个评估、批量评估)
 */

// 查询hooks
export { useOffersList as useOffers } from './useOffersList';
export { useOfferDetail as useOffer } from './useOfferDetail';
export { useOfferAccounts as useOfferLinkedAccounts } from './useOfferAccounts';
export { useOfferHistory as useOfferEvaluationHistory } from './useOfferHistory';
export { useOffersStats } from './useOffersStats';

// 操作hooks
export {
  useCreateOffer,
  useDeleteOffer,
  useToggleOfferFavorite,
  useUpdateOfferStatus,
} from './useOfferActions';

// 复合操作hook
export { useOfferActions } from './useOfferActionsComposite';

// 评估hooks
export {
  useEvaluateOffer,
  useBatchEvaluateOffers,
} from './useOfferEvaluation';

// 类型导出
export type * from '../types';
