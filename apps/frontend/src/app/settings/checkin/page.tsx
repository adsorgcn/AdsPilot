'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageLayout } from '~/core/ui/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { CalendarDays, Gift, Flame, Clock, CheckCircle, Star, TrendingUp } from 'lucide-react';
import { useRequireAuth } from '~/core/hooks/useRequireAuth';

interface CheckinStatus {
  lastCheckinAt?: string;
  totalCheckins: number;
  currentStreak: number;
  longestStreak: number;
  tokensEarned: number;
  canCheckin: boolean;
  todayChecked: boolean;
  nextCheckinTime?: string;
}

interface CheckinHistoryItem {
  id: string;
  tokensEarned: number;
  streakDay: number;
  checkinDate: string;
  createdAt: string;
}

interface CheckinResponse {
  success: boolean;
  tokensEarned: number;
  totalTokens: number;
  streak: number;
  message: string;
  nextCheckin: string;
}

export default function SettingsCheckinPage() {
  const { t } = useTranslation();
  const user = useRequireAuth();
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [history, setHistory] = useState<CheckinHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchCheckinStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = await user?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/v1/check-in/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch check-in status: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch check-in status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch check-in status');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchCheckinHistory = useCallback(async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/v1/check-in/history?limit=30', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setHistory(data.items || []);
    } catch (err) {
      console.error('Failed to fetch check-in history:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchCheckinStatus();
    fetchCheckinHistory();
  }, [fetchCheckinStatus, fetchCheckinHistory]);

  const handleCheckin = async () => {
    if (!status?.canCheckin) return;

    try {
      setIsCheckingIn(true);
      setError(null);
      setSuccessMessage(null);

      const token = await user?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/v1/check-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: 'web' }),
      });

      if (!response.ok) {
        throw new Error(`Failed to check in: ${response.statusText}`);
      }

      const data: CheckinResponse = await response.json();

      if (data.success) {
        setSuccessMessage(data.message);
        // Refresh status and history
        await fetchCheckinStatus();
        await fetchCheckinHistory();
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Failed to check in:', err);
      setError(err instanceof Error ? err.message : 'Failed to check in');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <SettingsPageLayout>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {t('checkin.loading', 'Loading check-in status...')}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('checkin.title', 'Daily Check-in')}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('checkin.description', 'Check in daily to earn tokens and maintain your streak')}
            </p>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <div className="h-4 w-4">⚠️</div>
                <span className="text-sm">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {successMessage && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">{successMessage}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {status && (
          <>
            {/* Main Check-in Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  {t('checkin.dailyCheckin', 'Daily Check-in')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left Column - Check-in Button */}
                  <div className="text-center">
                    <div className="mb-6">
                      <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 ${
                        status.todayChecked
                          ? 'border-green-200 bg-green-50'
                          : 'border-primary bg-primary/10'
                      } mb-4`}>
                        {status.todayChecked ? (
                          <CheckCircle className="h-12 w-12 text-green-600" />
                        ) : (
                          <Gift className="h-12 w-12 text-primary" />
                        )}
                      </div>
                      <h3 className="text-xl font-semibold mb-2">
                        {status.todayChecked
                          ? t('checkin.completed', "Today's Check-in Completed")
                          : t('checkin.ready', 'Ready to Check-in')
                        }
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {status.todayChecked
                          ? t('checkin.tomorrow', 'Come back tomorrow for your next reward!')
                          : t('checkin.claimReward', 'Claim your daily token reward!')
                        }
                      </p>
                    </div>

                    <Button
                      size="lg"
                      onClick={handleCheckin}
                      disabled={!status.canCheckin || isCheckingIn}
                      className="w-full md:w-auto px-8 py-3"
                    >
                      {isCheckingIn ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {t('checkin.processing', 'Processing...')}
                        </>
                      ) : status.todayChecked ? (
                        <>
                          <Clock className="h-4 w-4 mr-2" />
                          {t('checkin.completed', 'Completed')}
                        </>
                      ) : (
                        <>
                          <Gift className="h-4 w-4 mr-2" />
                          {t('checkin.checkin', 'Check In Now')}
                        </>
                      )}
                    </Button>

                    {status.nextCheckinTime && (
                      <p className="text-sm text-muted-foreground mt-3">
                        {t('checkin.nextTime', 'Next check-in available:')}{formatDateTime(status.nextCheckinTime)}
                      </p>
                    )}
                  </div>

                  {/* Right Column - Stats */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-2">
                          <Flame className="h-5 w-5 text-orange-500" />
                          <span className="text-2xl font-bold">{status.currentStreak}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('checkin.currentStreak', 'Current Streak')}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-2">
                          <TrendingUp className="h-5 w-5 text-blue-500" />
                          <span className="text-2xl font-bold">{status.longestStreak}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('checkin.longestStreak', 'Longest Streak')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{t('checkin.totalCheckins', 'Total Check-ins')}</span>
                        <Badge variant="secondary">{status.totalCheckins}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{t('checkin.totalTokens', 'Total Tokens Earned')}</span>
                        <Badge variant="outline">{status.tokensEarned}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Rewards Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  {t('checkin.tokenRewards', 'Token Rewards')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">{t('checkin.howItWorks', 'How it Works')}</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• {t('checkin.dailyReward', 'Daily reward: 10 tokens per day')}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">{t('checkin.todayReward', "Today's Reward")}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">{t('checkin.reward', 'Daily Reward')}</span>
                        <span className="text-sm font-medium">10 tokens</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

  
            {/* Check-in History */}
            {history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('checkin.history', 'Check-in History')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {history.slice(0, 10).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <CalendarDays className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.checkinDate}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('checkin.dayX', 'Day {{day}}', { day: item.streakDay })}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          +{item.tokensEarned} tokens
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </SettingsPageLayout>
  );
}