import { useMemo } from 'react';
import {
  useBillingTokenBalance,
  useCheckinStatus,
  useReferralSummary,
  useTokenTransactions,
  useUserSubscription,
} from '~/lib/billing';

type Maybe<T> = T | null | undefined;

const PROFILE_FIELDS: Array<{ label: string; key: string }> = [
  { label: '姓名', key: 'displayName' },
  { label: '公司/组织', key: 'company' },
  { label: '角色', key: 'role' },
];

const DEFAULT_PROFILE_VALUES: Record<string, string> = {
  displayName: '',
  company: '',
  role: '',
};

function mergeProfileData(profile: Maybe<unknown>) {
  if (!profile || typeof profile !== 'object') {
    return DEFAULT_PROFILE_VALUES;
  }

  const result: Record<string, string> = { ...DEFAULT_PROFILE_VALUES };
  const source = profile as Record<string, unknown>;

  PROFILE_FIELDS.forEach(({ key }) => {
    const value = source[key];

    if (typeof value === 'string') {
      result[key] = value;
    }
  });

  return result;
}

export function useUserInfoData(profile: Maybe<unknown>) {
  const mergedProfile = useMemo(() => mergeProfileData(profile), [profile]);

  const subscription = useUserSubscription();
  const tokenBalance = useBillingTokenBalance();
  const transactions = useTokenTransactions();
  const checkin = useCheckinStatus();
  const referral = useReferralSummary();

  return {
    mergedProfile,
    subscription,
    tokenBalance,
    transactions,
    checkin,
    referral,
  };
}
