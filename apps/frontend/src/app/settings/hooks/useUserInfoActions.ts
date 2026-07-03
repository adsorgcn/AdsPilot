import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  performDailyCheckin,
  refreshReferralSummary,
  useBillingTokenBalance,
  useCheckinStatus,
  useReferralSummary,
} from '~/lib/billing';

function buildReferralLink(code: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.autoads.dev';
  return `${base}/auth?ref=${code}`;
}

export function useUserInfoActions() {
  const tokenBalance = useBillingTokenBalance();
  const checkin = useCheckinStatus();
  const referral = useReferralSummary();

  const onCopyReferralLink = useCallback(async () => {
    if (!referral.data?.referralCode) {
      return;
    }

    const link = buildReferralLink(referral.data.referralCode);

    try {
      await navigator.clipboard.writeText(link);
      toast.success('邀请链接已复制');
    } catch (error) {
      console.error('[userinfo] copy referral link failed', error);
      toast.error('复制失败，请手动复制链接');
    }
  }, [referral.data?.referralCode]);

  const onRefreshReferralCode = useCallback(async () => {
    try {
      await refreshReferralSummary();
      await referral.refetch();
      toast.success('已生成新的邀请码');
    } catch (error) {
      console.error('[userinfo] refresh referral code failed', error);
      toast.error('生成邀请码失败');
    }
  }, [referral]);

  const onPerformCheckin = useCallback(async () => {
    try {
      const result = await performDailyCheckin();

      toast.success(
        `签到成功：获得 ${result.reward} Token${result.message ? `（${result.message}）` : ''}`,
      );

      await checkin.refetch();
      await tokenBalance.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '签到失败，请稍后再试';
      toast.error(message);
    }
  }, [checkin, tokenBalance]);

  return {
    onCopyReferralLink,
    onRefreshReferralCode,
    onPerformCheckin,
  };
}
