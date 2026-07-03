'use client';

import { useState, useEffect } from 'react';
import {
  User,
  CreditCard,
  Gift,
    Settings as SettingsIcon,
  CalendarDays,
  Wallet,
  Menu,
  X
} from 'lucide-react';
import { useRequireAuth } from '~/core/hooks/useRequireAuth';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import { useUserInfoData } from './hooks/useUserInfoData';
import { useUserInfoActions } from './hooks/useUserInfoActions';

// ✅ 懒加载Tab组件 - 减少设置页面包体积
import { ProfileTab } from './components/ProfileTab';
import { SubscriptionTab } from './components/SubscriptionTab';
import { TokensTab } from './components/TokensTab';
import { ReferralTab } from './components/ReferralTab';
import { CheckinTab } from './components/CheckinTab';

// Tab配置
const TABS = [
  { id: 'profile', label: '个人信息', icon: User, mobileLabel: '个人' },
  { id: 'subscription', label: '订阅管理', icon: CreditCard, mobileLabel: '订阅' },
  { id: 'tokens', label: 'Token余额', icon: Wallet, mobileLabel: '余额' },
  { id: 'referral', label: '邀请奖励', icon: Gift, mobileLabel: '邀请' },
  { id: 'checkin', label: '每日签到', icon: CalendarDays, mobileLabel: '签到' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function SettingsPage() {
  const user = useRequireAuth();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const {
    subscription
  } = useEnhancedSubscription();

  const {
    mergedProfile,
    subscription: userSubscription,
    tokenBalance,
    transactions,
    checkin,
    referral,
  } = useUserInfoData(user?.data);

  const { onCopyReferralLink, onRefreshReferralCode, onPerformCheckin } = useUserInfoActions();

  // 从URL参数读取Tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab') as TabId;
    if (tabParam && TABS.some(tab => tab.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  // 更新URL参数
  const updateTabInUrl = (tabId: TabId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url.toString());
  };

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    updateTabInUrl(tabId);
    setIsMobileMenuOpen(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab profile={mergedProfile} email={user?.auth?.user?.email || ''} />;
      case 'subscription':
        return (
          <SubscriptionTab
            subscriptionTier={subscription?.tier ?? userSubscription?.tier ?? 'trial'}
            data={userSubscription?.data ?? null}
          />
        );
      case 'tokens':
        return <TokensTab balance={tokenBalance} transactions={transactions?.data || []} />;
      case 'referral':
        return (
          <ReferralTab
            summary={referral?.data}
            isLoading={!referral?.data && referral?.isLoading}
            onCopy={onCopyReferralLink}
            onRefresh={onRefreshReferralCode}
          />
        );
      case 'checkin':
        return (
          <CheckinTab
            status={checkin?.data}
            isLoading={checkin?.isLoading}
            onCheckin={onPerformCheckin}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">设置</h1>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Navigation - Desktop */}
          <div className="hidden md:block md:w-64">
            <nav className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Admin Panel - Only for admins */}
            {user?.data?.role === 'admin' && (
              <div className="mt-8 pt-8 border-t">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  管理
                </h3>
                <nav className="space-y-1">
                  <a
                    href="/manage"
                    className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <SettingsIcon className="mr-3 h-5 w-5" />
                    管理面板
                  </a>
                </nav>
              </div>
            )}
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-50 bg-black bg-opacity-50">
              <div className="bg-white w-64 h-full shadow-lg">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">菜单</h2>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-2 rounded-md text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <nav className="p-4 space-y-2">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="mr-3 h-5 w-5" />
                        {tab.label}
                      </button>
                    );
                  })}

                  {user?.data?.role === 'admin' && (
                    <>
                      <div className="border-t pt-4 mt-4">
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          管理
                        </h3>
                        <a
                          href="/manage"
                          className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        >
                          <SettingsIcon className="mr-3 h-5 w-5" />
                          管理面板
                        </a>
                      </div>
                    </>
                  )}
                </nav>
              </div>
            </div>
          )}

          {/* Mobile Tab Navigation */}
          <div className="md:hidden mb-6">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:bg-white/50'
                    }`}
                  >
                    <Icon className="h-4 w-4 mb-1" />
                    {tab.mobileLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
