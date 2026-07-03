'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Plus, Link2 } from 'lucide-react';
import { GradientText } from '~/components/ui/GradientText';
import { GradientButton } from '~/components/ui/GradientButton';
import { cn } from '~/core/generic/shadcn-utils';

interface DashboardHeroProps {
  userName?: string;
  onAddOffer?: () => void;
  onConnectAccount?: () => void;
  className?: string;
}

export function DashboardHero({
  userName,
  onAddOffer,
  onConnectAccount,
  className,
}: DashboardHeroProps) {
  const { t } = useTranslation('common');
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greeting.morning', 'Good morning');
    if (hour < 18) return t('dashboard.greeting.afternoon', 'Good afternoon');
    return t('dashboard.greeting.evening', 'Good evening');
  };

  return (
    <div className={cn('relative overflow-hidden rounded-2xl p-8 hero-gradient', className)}>
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 animate-pulse" />
      
      {/* Glass overlay */}
      <div className="absolute inset-0 backdrop-blur-3xl bg-white/30 dark:bg-slate-900/30" />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-muted-foreground">
                {t('dashboard.hero.welcome', 'Welcome back')}
              </span>
            </div>
            
            <h1 className="text-4xl font-bold mb-2">
              {getGreeting()}
              {userName && (
                <>
                  {', '}
                  <GradientText variant="primary" as="span">
                    {userName}
                  </GradientText>
                </>
              )}
            </h1>
            
            <p className="text-muted-foreground max-w-2xl">
              {t(
                'dashboard.hero.subtitle',
                'Manage your offers, track performance, and optimize your ad campaigns all in one place.'
              )}
            </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-3">
            {onAddOffer && (
              <GradientButton
                variant="primary"
                size="md"
                onClick={onAddOffer}
                className="shadow-lg"
              >
                <Plus className="h-4 w-4" />
                {t('dashboard.hero.addOffer', 'Add Offer')}
              </GradientButton>
            )}
            
            {onConnectAccount && (
              <GradientButton
                variant="outline"
                size="md"
                onClick={onConnectAccount}
                className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
              >
                <Link2 className="h-4 w-4" />
                {t('dashboard.hero.connectAccount', 'Connect Account')}
              </GradientButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}