'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageLayout } from '~/core/ui/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import { Button } from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { Alert, AlertTitle, AlertDescription } from '~/core/ui/Alert';
import {
  Share2,
  Copy,
  Users,
  Gift,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar
} from 'lucide-react';
import { useRequireAuth } from '~/core/hooks/useRequireAuth';
import { toast } from 'sonner';

interface ReferralInfo {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  successfulReferrals: number;
  totalRewards: number;
}

interface ReferralRecord {
  id: string;
  inviteeEmail?: string;
  status: string;
  rewardAmount: number;
  rewardGranted: boolean;
  createdAt: string;
  completedAt?: string;
}

interface TrialSubscription {
  id: string;
  trialType: string;
  startDate: string;
  endDate: string;
  daysGranted: number;
  source: string;
  isActive: boolean;
}

export default function ReferralPage() {
  const { t } = useTranslation();
  const user = useRequireAuth();
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [referralList, setReferralList] = useState<ReferralRecord[]>([]);
  const [activeTrial, setActiveTrial] = useState<TrialSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReferralInfo();
    fetchReferralList();
    fetchActiveTrial();
  }, []);

  const fetchReferralInfo = async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/v1/referral', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReferralInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch referral info:', err);
    }
  };

  const fetchReferralList = async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/v1/referral/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReferralList(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch referral list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveTrial = async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      // Get user ID from auth
      const userId = user?.auth?.user?.id;
      if (!userId) return;

      const response = await fetch(`/api/v1/billing/subscriptions/trial/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // The API returns an array of trial subscriptions
        if (data.items && data.items.length > 0) {
          // Get the most recent active trial
          const activeTrial = data.items.find((t: TrialSubscription) => t.isActive);
          if (activeTrial) {
            setActiveTrial(activeTrial);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch active trial:', err);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('referral.copied', { label }));
    } catch (err) {
      toast.error(t('referral.copyFailed'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('referral.status.completed')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t('referral.status.pending')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {t('referral.status.failed')}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const calculateDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <SettingsPageLayout>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {t('referral.loading')}
            </p>
          </div>
        </div>
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('referral.title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('referral.description')}
          </p>
        </div>

        {/* Active Trial Alert */}
        {activeTrial && activeTrial.isActive && (
          <Alert type="info">
            <Gift className="h-4 w-4" />
            <AlertTitle>{t('referral.activeTrial.title')}</AlertTitle>
            <AlertDescription>
              {t('referral.activeTrial.description', {
                days: calculateDaysRemaining(activeTrial.endDate),
                endDate: formatDate(activeTrial.endDate),
              })}
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        {referralInfo && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('referral.stats.total')}
                    </p>
                    <p className="text-2xl font-bold">{referralInfo.totalReferrals}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('referral.stats.successful')}
                    </p>
                    <p className="text-2xl font-bold">{referralInfo.successfulReferrals}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('referral.stats.rewards')}
                    </p>
                    <p className="text-2xl font-bold">{referralInfo.totalRewards}</p>
                  </div>
                  <Gift className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Referral Link Card */}
        {referralInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                {t('referral.shareLink.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Referral Code */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('referral.shareLink.code')}
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 p-3 bg-muted rounded-md font-mono text-lg">
                      {referralInfo.referralCode}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(referralInfo.referralCode, t('referral.shareLink.code'))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Referral Link */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('referral.shareLink.link')}
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 p-3 bg-muted rounded-md text-sm break-all">
                      {referralInfo.referralLink}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(referralInfo.referralLink, t('referral.shareLink.link'))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Referral List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('referral.list.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referralList.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {t('referral.list.empty')}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('referral.list.emptyDescription')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {referralList.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(referral.status)}
                        {referral.rewardGranted && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Gift className="h-3 w-3" />
                            {t('referral.list.rewardGranted')}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {t('referral.list.joined')}: {formatDate(referral.createdAt)}
                        </div>
                        {referral.completedAt && (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('referral.list.completed')}: {formatDate(referral.completedAt)}
                          </div>
                        )}
                      </div>
                    </div>
                    {referral.rewardAmount > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-muted-foreground">
                          {t('referral.list.reward')}
                        </p>
                        <p className="text-lg font-bold">
                          +{referral.rewardAmount} {t('common.tokens')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referral Program Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              {t('referral.program.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">{t('referral.program.inviteeReward')}</p>
                  <p className="text-muted-foreground">{t('referral.program.inviteeRewardDescription')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">{t('referral.program.inviterReward')}</p>
                  <p className="text-muted-foreground">{t('referral.program.inviterRewardDescription')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">{t('referral.program.stackable')}</p>
                  <p className="text-muted-foreground">{t('referral.program.stackableDescription')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsPageLayout>
  );
}
