'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePerformanceMetrics } from '~/core/state/GlobalStateProvider';

// PWA安装状态
interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  installPrompt: any; // BeforeInstallPromptEvent
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}

// 离线状态
interface OfflineState {
  isOnline: boolean;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
}

// 通知权限状态
interface NotificationState {
  permission: NotificationPermission;
  supported: boolean;
  subscribed: boolean;
}

// Service Worker状态
interface ServiceWorkerState {
  supported: boolean;
  registered: boolean;
  activated: boolean;
  controller: boolean;
  version: string;
  updating: boolean;
}

// PWA管理器Hook
export function usePWAManager() {
  const { recordInteraction, recordError } = usePerformanceMetrics();

  // PWA状态
  const [installState, setInstallState] = useState<PWAInstallState>({
    isInstallable: false,
    isInstalled: false,
    isStandalone: false,
    installPrompt: null,
    platform: 'unknown',
  });

  // 离线状态
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
  });

  // 通知状态
  const [notificationState, setNotificationState] = useState<NotificationState>({
    permission: 'default',
    supported: typeof window !== 'undefined' && 'Notification' in window,
    subscribed: false,
  });

  // Service Worker状态
  const [swState, setSwState] = useState<ServiceWorkerState>({
    supported: typeof window !== 'undefined' && 'serviceWorker' in navigator,
    registered: false,
    activated: false,
    controller: false,
    version: 'unknown',
    updating: false,
  });

  // 引用
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const deferredPromptRef = useRef<any>(null);

  // 初始化PWA检测
  useEffect(() => {
    detectInstallability();
    detectStandaloneMode();
    detectPlatform();
    updateConnectionInfo();
    updateNotificationStatus();

    // 初始化Service Worker
    initializeServiceWorker();

    // 监听网络状态变化
    const handleOnline = () => {
      setOfflineState(prev => ({ ...prev, isOnline: true }));
      recordInteraction('network_online');
    };

    const handleOffline = () => {
      setOfflineState(prev => ({ ...prev, isOnline: false }));
      recordInteraction('network_offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 监听连接信息变化
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const handleConnectionChange = () => updateConnectionInfo();
      connection.addEventListener('change', handleConnectionChange);
    }

    // 监听安装提示
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setInstallState(prev => ({ ...prev, isInstallable: true, installPrompt: e }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 监听应用安装
    const handleAppInstalled = () => {
      setInstallState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      deferredPromptRef.current = null;
      recordInteraction('pwa_installed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);

      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, [recordInteraction]);

  // 检测安装性
  const detectInstallability = useCallback(() => {
    // 检查是否在支持的浏览器中
    const isSupported = 'serviceWorker' in navigator &&
                       'BeforeInstallPromptEvent' in window;

    setInstallState(prev => ({ ...prev, isInstalled: !isSupported }));
  }, []);

  // 检测独立模式
  const detectStandaloneMode = useCallback(() => {
    const isStandalone =
      // Safari
      ('standalone' in window && (window as any).standalone) ||
      // iOS PWA
      (window.matchMedia('(display-mode: standalone)').matches) ||
      // Chrome PWA
      (window.matchMedia('(display-mode: minimal-ui)').matches) ||
      // Samsung Browser
      (window.matchMedia('(display-mode: browser)').matches === false);

    setInstallState(prev => ({ ...prev, isStandalone }));
  }, []);

  // 检测平台
  const detectPlatform = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(userAgent)) {
      setInstallState(prev => ({ ...prev, platform: 'ios' }));
    } else if (/android/.test(userAgent)) {
      setInstallState(prev => ({ ...prev, platform: 'android' }));
    } else if (/win|mac|linux/.test(userAgent)) {
      setInstallState(prev => ({ ...prev, platform: 'desktop' }));
    }
  }, []);

  // 更新连接信息
  const updateConnectionInfo = useCallback(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;

      setOfflineState(prev => ({
        ...prev,
        connectionType: connection.effectiveType || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
      }));
    }
  }, []);

  // 更新通知状态
  const updateNotificationStatus = useCallback(async () => {
    if (!('Notification' in window)) {
      setNotificationState(prev => ({ ...prev, supported: false }));
      return;
    }

    const permission = await Notification.requestPermission();

    setNotificationState(prev => ({
      ...prev,
      permission,
      supported: true,
    }));

    // 检查推送订阅状态
    if (swRegistrationRef.current && permission === 'granted') {
      try {
        const subscription = await swRegistrationRef.current.pushManager.getSubscription();
        setNotificationState(prev => ({
          ...prev,
          subscribed: !!subscription,
        }));
      } catch (error) {
        console.error('Failed to check push subscription:', error);
      }
    }
  }, []);

  // 初始化Service Worker
  const initializeServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      swRegistrationRef.current = registration;

      // 监听Service Worker状态变化
      registration.addEventListener('updatefound', () => {
        setSwState(prev => ({ ...prev, updating: true }));
        recordInteraction('sw_update_found');
      });

      // 检查Service Worker是否激活
      if (registration.active) {
        setSwState({
          supported: true,
          registered: true,
          activated: true,
          controller: !!navigator.serviceWorker.controller,
          version: await getSWVersion(registration),
          updating: false,
        });
      } else {
        setSwState({
          supported: true,
          registered: true,
          activated: false,
          controller: false,
          version: 'installing',
          updating: false,
        });

        // 监听激活
        registration.addEventListener('controllerchange', () => {
          setSwState(prev => ({ ...prev, controller: true, activated: true }));
          window.location.reload(); // 重新加载页面获取最新版本
        });
      }

      console.log('Service Worker registered successfully:', registration.scope);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      recordError('sw_registration_failed');
    }
  }, [recordInteraction, recordError]);

  // 获取Service Worker版本
  const getSWVersion = async (registration: ServiceWorkerRegistration): Promise<string> => {
    try {
      if (registration.active) {
        // 尝试从Service Worker获取版本信息
        const response = await fetch('/sw-version.json');
        const data = await response.json();
        return data.version || 'unknown';
      }
    } catch (error) {
      console.warn('Failed to get SW version:', error);
    }
    return 'unknown';
  };

  // 安装PWA
  const installPWA = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptRef.current) {
      console.warn('No install prompt available');
      return false;
    }

    try {
      // 显示安装提示
      const result = await deferredPromptRef.current.prompt();
      const { outcome } = await result.userChoice;

      if (outcome === 'accepted') {
        recordInteraction('pwa_install_accepted');
        return true;
      } else {
        recordInteraction('pwa_install_dismissed');
        return false;
      }
    } catch (error) {
      console.error('PWA installation failed:', error);
      recordError('pwa_install_failed');
      return false;
    }
  }, [recordInteraction, recordError]);

  // 请求通知权限
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();

      setNotificationState(prev => ({ ...prev, permission }));

      if (permission === 'granted') {
        recordInteraction('notification_permission_granted');
        return true;
      } else {
        recordInteraction('notification_permission_denied');
        return false;
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      recordError('notification_permission_failed');
      return false;
    }
  }, [recordInteraction, recordError]);

  // 订阅推送通知
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!swRegistrationRef.current || notificationState.permission !== 'granted') {
      console.warn('Push notification prerequisites not met');
      return false;
    }

    try {
      // 这里需要你的VAPID公钥
      const applicationServerKey = urlB64ToUint8Array(
        'YOUR_VAPID_PUBLIC_KEY_HERE'
      );

      const subscription = await swRegistrationRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 发送订阅信息到服务器
      await sendSubscriptionToServer(subscription);

      setNotificationState(prev => ({ ...prev, subscribed: true }));
      recordInteraction('push_subscription_success');

      return true;
    } catch (error) {
      console.error('Push subscription failed:', error);
      recordError('push_subscription_failed');
      return false;
    }
  }, [notificationState.permission, recordInteraction, recordError]);

  // 发送订阅信息到服务器
  const sendSubscriptionToServer = async (subscription: PushSubscription): Promise<void> => {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  };

  // URL base64 to Uint8Array conversion
  const urlB64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // 显示本地通知
  const showLocalNotification = useCallback((
    title: string,
    options?: NotificationOptions
  ): boolean => {
    if (notificationState.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    try {
      const notification = new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'gm-notification',
        requireInteraction: false,
        ...options,
      });

      // 自动关闭通知
      setTimeout(() => {
        notification.close();
      }, 5000);

      recordInteraction('local_notification_shown');
      return true;
    } catch (error) {
      console.error('Failed to show local notification:', error);
      recordError('local_notification_failed');
      return false;
    }
  }, [notificationState.permission, recordInteraction, recordError]);

  // 更新Service Worker
  const updateServiceWorker = useCallback(async (): Promise<boolean> => {
    if (!swRegistrationRef.current) {
      console.warn('Service Worker not registered');
      return false;
    }

    try {
      await swRegistrationRef.current.update();
      recordInteraction('sw_update_triggered');
      return true;
    } catch (error) {
      console.error('Service Worker update failed:', error);
      recordError('sw_update_failed');
      return false;
    }
  }, [recordInteraction, recordError]);

  // 检查缓存状态
  const checkCacheStatus = useCallback(async (): Promise<{
    cacheNames: string[];
    totalSize: number;
    entries: Array<{ name: string; size: number; count: number }>;
  }> => {
    try {
      const cacheNames = await caches.keys();
      const cacheData = [];

      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();

        let cacheSize = 0;
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const responseClone = response.clone();
            const blob = await responseClone.blob();
            cacheSize += blob.size;
          }
        }

        totalSize += cacheSize;
        cacheData.push({
          name: cacheName,
          size: cacheSize,
          count: keys.length,
        });
      }

      return {
        cacheNames,
        totalSize,
        entries: cacheData,
      };
    } catch (error) {
      console.error('Failed to check cache status:', error);
      return {
        cacheNames: [],
        totalSize: 0,
        entries: [],
      };
    }
  }, []);

  // 清理缓存
  const clearCache = useCallback(async (cacheName?: string): Promise<boolean> => {
    try {
      if (cacheName) {
        await caches.delete(cacheName);
        recordInteraction('cache_cleared', { cacheName });
      } else {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        recordInteraction('all_cache_cleared');
      }
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      recordError('cache_clear_failed');
      return false;
    }
  }, [recordInteraction, recordError]);

  return {
    // 状态
    installState,
    offlineState,
    notificationState,
    swState,

    // PWA功能
    installPWA,
    requestNotificationPermission,
    subscribeToPush,
    showLocalNotification,

    // Service Worker功能
    updateServiceWorker,
    checkCacheStatus,
    clearCache,

    // 工具方法
    detectStandaloneMode,
    updateConnectionInfo,
  };
}

// PWA安装提示组件
interface PWAInstallPromptProps {
  className?: string;
  onInstall?: () => void;
  onDismiss?: () => void;
}

export function PWAInstallPrompt({ className = '', onInstall, onDismiss }: PWAInstallPromptProps) {
  const { installState, installPWA } = usePWAManager();
  const [dismissed, setDismissed] = useState(false);

  const handleInstall = async () => {
    const success = await installPWA();
    if (success) {
      onInstall?.();
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // 不显示提示的条件
  if (!installState.isInstallable ||
      installState.isInstalled ||
      installState.isStandalone ||
      dismissed) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">安装 Google-Monetize 应用</h3>
            <p className="text-sm text-gray-600">获得更好的使用体验，支持离线访问</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleInstall}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            安装
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// 离线指示器组件
export function OfflineIndicator() {
  const { offlineState } = usePWAManager();

  if (offlineState.isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white p-2 text-center z-50">
      <div className="flex items-center justify-center space-x-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span className="text-sm font-medium">您当前处于离线状态</span>
      </div>
    </div>
  );
}