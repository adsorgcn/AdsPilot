'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePerformanceMetrics } from '~/core/state/GlobalStateProvider';

// 设备类型
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

// 屏幕尺寸
interface ScreenSize {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

// 触摸能力
interface TouchCapabilities {
  supported: boolean;
  maxTouchPoints: number;
  hasForceTouch: boolean;
  hasCoarsePointer: boolean;
}

// 移动端优化配置
interface MobileOptimizationConfig {
  // 触摸优化
  enableTouchOptimization: boolean;
  tapDelay: number; // 触摸延迟（毫秒）
  scrollOptimization: boolean;
  pullToRefresh: boolean;

  // 视口优化
  enableViewportOptimization: boolean;
  preventZoom: boolean;
  enableSafeArea: boolean;

  // 性能优化
  enableReducedMotion: boolean;
  enableBatteryOptimization: boolean;
  enableLowPowerMode: boolean;

  // 响应式优化
  enableResponsiveImages: boolean;
  enableResponsiveLayout: boolean;
  enableProgressiveEnhancement: boolean;

  // 用户体验优化
  enableOfflineFirst: boolean;
  enableHapticFeedback: boolean;
  enableVibration: boolean;
}

// 默认配置
const DEFAULT_CONFIG: MobileOptimizationConfig = {
  enableTouchOptimization: true,
  tapDelay: 300,
  scrollOptimization: true,
  pullToRefresh: false,

  enableViewportOptimization: true,
  preventZoom: false,
  enableSafeArea: true,

  enableReducedMotion: true,
  enableBatteryOptimization: true,
  enableLowPowerMode: false,

  enableResponsiveImages: true,
  enableResponsiveLayout: true,
  enableProgressiveEnhancement: true,

  enableOfflineFirst: true,
  enableHapticFeedback: true,
  enableVibration: true,
};

// 移动端优化器Hook
export function useMobileOptimizer(customConfig: Partial<MobileOptimizationConfig> = {}) {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...customConfig }), [customConfig]);
  const { recordInteraction } = usePerformanceMetrics();

  // 设备信息
  const [deviceType, setDeviceType] = useState<DeviceType>('unknown');
  const [screenSize, setScreenSize] = useState<ScreenSize>({
    width: 0,
    height: 0,
    orientation: 'portrait',
    breakpoint: 'md',
  });
  const [touchCapabilities, setTouchCapabilities] = useState<TouchCapabilities>({
    supported: false,
    maxTouchPoints: 0,
    hasForceTouch: false,
    hasCoarsePointer: false,
  });

  // 电池信息
  const [batteryInfo, setBatteryInfo] = useState<{
    level: number;
    charging: boolean;
    dischargingTime: number;
  } | null>(null);

  // 网络信息
  const [networkInfo, setNetworkInfo] = useState<{
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  } | null>(null);

  // 状态引用
  const lastTapTime = useRef<number>(0);
  const scrollTimeout = useRef<NodeJS.Timeout>();

  // 检测设备类型
  const detectDeviceType = useCallback((): DeviceType => {
    const userAgent = navigator.userAgent.toLowerCase();
    const screenWidth = window.innerWidth;

    // 基于User-Agent检测
    if (/mobile|phone|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      return 'mobile';
    }

    if (/ipad|tablet|kindle|silk|playbook|tablet/i.test(userAgent)) {
      return 'tablet';
    }

    // 基于屏幕尺寸检测（备用）
    if (screenWidth <= 768) {
      return 'mobile';
    } else if (screenWidth <= 1024) {
      return 'tablet';
    }

    return 'desktop';
  }, []);

  // 检测屏幕尺寸
  const detectScreenSize = useCallback((): ScreenSize => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const orientation = width > height ? 'landscape' : 'portrait';

    let breakpoint: ScreenSize['breakpoint'] = 'md';
    if (width < 640) breakpoint = 'xs';
    else if (width < 768) breakpoint = 'sm';
    else if (width < 1024) breakpoint = 'md';
    else if (width < 1280) breakpoint = 'lg';
    else if (width < 1536) breakpoint = 'xl';
    else breakpoint = '2xl';

    return { width, height, orientation, breakpoint };
  }, []);

  // 检测触摸能力
  const detectTouchCapabilities = useCallback((): TouchCapabilities => {
    return {
      supported: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      hasForceTouch: 'ontouchforcechange' in window,
      hasCoarsePointer: window.matchMedia('(pointer: coarse)').matches,
    };
  }, []);

  // 检测电池信息
  const detectBatteryInfo = useCallback(async () => {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();

        const batteryData = {
          level: battery.level,
          charging: battery.charging,
          dischargingTime: battery.dischargingTime,
        };

        setBatteryInfo(batteryData);

        // 监听电池状态变化
        battery.addEventListener('levelchange', () => {
          setBatteryInfo(prev => prev ? { ...prev, level: battery.level } : null);
        });

        battery.addEventListener('chargingchange', () => {
          setBatteryInfo(prev => prev ? { ...prev, charging: battery.charging } : null);
        });

        return batteryData;
      } catch (error) {
        console.warn('Battery API not available:', error);
      }
    }
    return null;
  }, []);

  // 检测网络信息
  const detectNetworkInfo = useCallback(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;

      const networkData = {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false,
      };

      setNetworkInfo(networkData);

      // 监听网络变化
      connection.addEventListener('change', () => {
        setNetworkInfo({
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          saveData: connection.saveData || false,
        });
      });

      return networkData;
    }
    return null;
  }, []);

  // 获取响应式值
  const getResponsiveValue = useCallback(<T,>(
    values: Record<ScreenSize['breakpoint'], T>,
    defaultValue: T
  ): T => {
    return values[screenSize.breakpoint] || defaultValue;
  }, [screenSize]);

  // 优化点击事件
  const optimizeTapEvent = useCallback((
    event: React.TouchEvent | React.MouseEvent,
    callback: () => void,
    delay?: number
  ) => {
    if (!config.enableTouchOptimization) {
      callback();
      return;
    }

    const now = Date.now();
    const tapDelay = delay ?? config.tapDelay;

    // 防止双击
    if (now - lastTapTime.current < tapDelay) {
      event.preventDefault();
      return;
    }

    lastTapTime.current = now;
    callback();

    // 触觉反馈
    if (config.enableHapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10); // 短振动
    }
  }, [config]);

  // 优化滚动
  const optimizeScroll = useCallback((callback: () => void, debounce: number = 100) => {
    if (!config.scrollOptimization) {
      callback();
      return;
    }

    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = setTimeout(() => {
      callback();
    }, debounce);
  }, [config]);

  // 触觉反馈
  const triggerHapticFeedback = useCallback((
    pattern: number | number[] = 10
  ): boolean => {
    if (!config.enableHapticFeedback || !('vibrate' in navigator)) {
      return false;
    }

    try {
      navigator.vibrate(pattern);
      recordInteraction('haptic_feedback', { pattern });
      return true;
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
      return false;
    }
  }, [config, recordInteraction]);

  // 检查是否为低功耗模式
  const isLowPowerMode = useCallback((): boolean => {
    if (!config.enableBatteryOptimization || !batteryInfo) {
      return false;
    }

    return !batteryInfo.charging && batteryInfo.level < 0.2;
  }, [config, batteryInfo]);

  // 检查网络状况
  const isSlowNetwork = useCallback((): boolean => {
    if (!networkInfo) return false;

    return networkInfo.effectiveType === 'slow-2g' ||
           networkInfo.effectiveType === '2g' ||
           networkInfo.effectiveType === '3g' ||
           networkInfo.saveData;
  }, [networkInfo]);

  // 获取优化建议
  const getOptimizationSuggestions = useCallback((): Array<{
    category: 'performance' | 'ux' | 'accessibility';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    applicable: boolean;
  }> => {
    const suggestions = [];

    // 性能建议
    if (isLowPowerMode()) {
      suggestions.push({
        category: 'performance',
        title: '启用低功耗模式',
        description: '检测到设备电量不足，建议启用低功耗模式以延长电池寿命',
        priority: 'high',
        applicable: true,
      });
    }

    if (isSlowNetwork()) {
      suggestions.push({
        category: 'performance',
        title: '优化网络使用',
        description: '检测到网络连接较慢，建议减少数据传输和启用离线功能',
        priority: 'high',
        applicable: true,
      });
    }

    // 用户体验建议
    if (deviceType === 'mobile' && !touchCapabilities.supported) {
      suggestions.push({
        category: 'ux',
        title: '启用触摸优化',
        description: '移动设备建议启用触摸优化以改善用户体验',
        priority: 'high',
        applicable: true,
      });
    }

    // 可访问性建议
    if (touchCapabilities.hasCoarsePointer) {
      suggestions.push({
        category: 'accessibility',
        title: '增加触摸目标大小',
        description: '检测到粗指针输入，建议增加按钮和链接的触摸目标大小',
        priority: 'medium',
        applicable: true,
      });
    }

    return suggestions;
  }, [deviceType, touchCapabilities, isLowPowerMode, isSlowNetwork]);

  // 初始化检测
  useEffect(() => {
    const updateDeviceInfo = () => {
      setDeviceType(detectDeviceType());
      setScreenSize(detectScreenSize());
      setTouchCapabilities(detectTouchCapabilities());
    };

    updateDeviceInfo();
    detectBatteryInfo();
    detectNetworkInfo();

    // 监听屏幕尺寸变化
    const handleResize = () => {
      setScreenSize(detectScreenSize());
      // 重新检测设备类型（可能从移动端切换到桌面端）
      const newDeviceType = detectDeviceType();
      if (newDeviceType !== deviceType) {
        setDeviceType(newDeviceType);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [detectDeviceType, detectScreenSize, detectTouchCapabilities, detectBatteryInfo, detectNetworkInfo, deviceType]);

  // 设置视口优化
  useEffect(() => {
    if (!config.enableViewportOptimization || typeof document === 'undefined') {
      return;
    }

    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      let content = 'width=device-width, initial-scale=1.0';

      if (config.preventZoom) {
        content += ', user-scalable=no, maximum-scale=1.0';
      }

      if (config.enableSafeArea && deviceType === 'mobile') {
        content += ', viewport-fit=cover';
      }

      viewport.setAttribute('content', content);
    }
  }, [config, deviceType]);

  // 设置CSS变量
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // 设置设备类型变量
    root.style.setProperty('--device-type', deviceType);
    root.style.setProperty('--is-mobile', deviceType === 'mobile' ? '1' : '0');
    root.style.setProperty('--is-tablet', deviceType === 'tablet' ? '1' : '0');
    root.style.setProperty('--is-desktop', deviceType === 'desktop' ? '1' : '0');

    // 设置屏幕尺寸变量
    root.style.setProperty('--screen-width', `${screenSize.width}px`);
    root.style.setProperty('--screen-height', `${screenSize.height}px`);
    root.style.setProperty('--screen-orientation', screenSize.orientation);

    // 设置触摸能力变量
    root.style.setProperty('--touch-supported', touchCapabilities.supported ? '1' : '0');
    root.style.setProperty('--touch-points', touchCapabilities.maxTouchPoints.toString());
    root.style.setProperty('--coarse-pointer', touchCapabilities.hasCoarsePointer ? '1' : '0');

    // 设置网络状况变量
    if (networkInfo) {
      root.style.setProperty('--network-type', networkInfo.effectiveType);
      root.style.setProperty('--network-slow', isSlowNetwork() ? '1' : '0');
    }

    // 设置电池状态变量
    if (batteryInfo) {
      root.style.setProperty('--battery-level', batteryInfo.level.toString());
      root.style.setProperty('--battery-charging', batteryInfo.charging ? '1' : '0');
      root.style.setProperty('--low-power', isLowPowerMode() ? '1' : '0');
    }
  }, [deviceType, screenSize, touchCapabilities, networkInfo, batteryInfo, isSlowNetwork, isLowPowerMode]);

  return {
    // 设备信息
    deviceType,
    screenSize,
    touchCapabilities,
    batteryInfo,
    networkInfo,

    // 检测方法
    isLowPowerMode,
    isSlowNetwork,

    // 响应式工具
    getResponsiveValue,

    // 优化方法
    optimizeTapEvent,
    optimizeScroll,
    triggerHapticFeedback,

    // 建议生成
    getOptimizationSuggestions,

    // 配置
    config,
  };
}

// 响应式Hook
export function useResponsive<T>(
  values: Record<ScreenSize['breakpoint'], T>,
  defaultValue: T
): T {
  const { getResponsiveValue } = useMobileOptimizer();
  return getResponsiveValue(values, defaultValue);
}

// 移动端检测Hook
export function useMobile(): boolean {
  const { deviceType } = useMobileOptimizer();
  return deviceType === 'mobile';
}

// 平板检测Hook
export function useTablet(): boolean {
  const { deviceType } = useMobileOptimizer();
  return deviceType === 'tablet';
}

// 桌面端检测Hook
export function useDesktop(): boolean {
  const { deviceType } = useMobileOptimizer();
  return deviceType === 'desktop';
}

// 触摸设备检测Hook
export function useTouchDevice(): boolean {
  const { touchCapabilities } = useMobileOptimizer();
  return touchCapabilities.supported;
}

// 屏幕方向Hook
export function useScreenOrientation(): 'portrait' | 'landscape' {
  const { screenSize } = useMobileOptimizer();
  return screenSize.orientation;
}

// 安全区域Hook
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateSafeArea = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      const top = parseInt(computedStyle.getPropertyValue('--safe-area-inset-top')) || 0;
      const right = parseInt(computedStyle.getPropertyValue('--safe-area-inset-right')) || 0;
      const bottom = parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom')) || 0;
      const left = parseInt(computedStyle.getPropertyValue('--safe-area-inset-left')) || 0;

      setSafeArea({ top, right, bottom, left });
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);
    window.addEventListener('orientationchange', updateSafeArea);

    return () => {
      window.removeEventListener('resize', updateSafeArea);
      window.removeEventListener('orientationchange', updateSafeArea);
    };
  }, []);

  return safeArea;
}

// 触摸优化按钮组件
interface OptimizedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  haptic?: boolean;
}

export function OptimizedButton({
  children,
  onClick,
  className = '',
  disabled = false,
  variant = 'primary',
  size = 'md',
  haptic = true
}: OptimizedButtonProps) {
  const { optimizeTapEvent, triggerHapticFeedback } = useMobileOptimizer();

  const handleClick = (event: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;

    const wrappedCallback = () => {
      onClick?.();
      if (haptic) {
        triggerHapticFeedback();
      }
    };

    optimizeTapEvent(event, wrappedCallback);
  };

  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// 触摸优化卡片组件
interface OptimizedCardProps {
  children: React.ReactNode;
  className?: string;
  onTap?: () => void;
  hover?: boolean;
}

export function OptimizedCard({
  children,
  className = '',
  onTap,
  hover = true
}: OptimizedCardProps) {
  const { optimizeTapEvent, triggerHapticFeedback } = useMobileOptimizer();

  const handleTap = (event: React.TouchEvent) => {
    if (!onTap) return;

    const wrappedCallback = () => {
      onTap();
      triggerHapticFeedback();
    };

    optimizeTapEvent(event, wrappedCallback);
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 ${hover ? 'hover:shadow-md transition-shadow' : ''} ${className}`}
      onTouchStart={handleTap}
    >
      {children}
    </div>
  );
}