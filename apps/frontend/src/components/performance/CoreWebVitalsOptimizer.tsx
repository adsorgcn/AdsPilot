'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LightBulbIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  CogIcon,
  ChartBarIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

// Core Web Vitals 优化策略
interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  category: 'loading' | 'interactivity' | 'visual-stability' | 'accessibility';
  priority: 'critical' | 'high' | 'medium' | 'low';
  implementation: 'automatic' | 'manual';
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  status: 'not-implemented' | 'in-progress' | 'implemented';
  code?: string;
  resources?: string[];
}

// LCP 优化策略
const LCPOptimizations: OptimizationStrategy[] = [
  {
    id: 'optimize-images',
    name: 'Optimize Images',
    description: 'Compress images, use modern formats (WebP/AVIF), implement lazy loading, and add appropriate dimensions',
    category: 'loading',
    priority: 'critical',
    implementation: 'automatic',
    impact: 'high',
    effort: 'medium',
    status: 'not-implemented',
    resources: ['https://web.dev/optimize-images/']
  },
  {
    id: 'preload-critical-resources',
    name: 'Preload Critical Resources',
    description: 'Preload critical CSS, fonts, and JavaScript that are needed for above-the-fold content',
    category: 'loading',
    priority: 'high',
    implementation: 'manual',
    impact: 'high',
    effort: 'low',
    status: 'not-implemented',
    code: `<link rel="preload" href="/fonts/critical.woff2" as="font" type="font/woff2" crossorigin>`
  },
  {
    id: 'remove-render-blocking',
    name: 'Remove Render-Blocking Resources',
    description: 'Eliminate or defer render-blocking JavaScript and CSS that delays page rendering',
    category: 'loading',
    priority: 'critical',
    implementation: 'automatic',
    impact: 'high',
    effort: 'medium',
    status: 'not-implemented'
  },
  {
    id: 'server-response-time',
    name: 'Optimize Server Response Time',
    description: 'Reduce TTFB by optimizing backend performance, using CDN, and implementing caching',
    category: 'loading',
    priority: 'high',
    implementation: 'manual',
    impact: 'high',
    effort: 'high',
    status: 'not-implemented'
  }
];

// FID 优化策略
const FIDOptimizations: OptimizationStrategy[] = [
  {
    id: 'reduce-javascript-execution',
    name: 'Reduce JavaScript Execution Time',
    description: 'Minimize main thread work, code-split, and remove unused JavaScript',
    category: 'interactivity',
    priority: 'critical',
    implementation: 'automatic',
    impact: 'high',
    effort: 'medium',
    status: 'not-implemented'
  },
  {
    id: 'web-workers',
    name: 'Use Web Workers',
    description: 'Move heavy computations off the main thread using Web Workers',
    category: 'interactivity',
    priority: 'medium',
    implementation: 'manual',
    impact: 'medium',
    effort: 'high',
    status: 'not-implemented'
  },
  {
    id: 'optimize-third-party-scripts',
    name: 'Optimize Third-Party Scripts',
    description: 'Defer loading, use async/defer attributes, and self-host critical third-party scripts',
    category: 'interactivity',
    priority: 'high',
    implementation: 'manual',
    impact: 'medium',
    effort: 'medium',
    status: 'not-implemented'
  }
];

// CLS 优化策略
const CLSOptimizations: OptimizationStrategy[] = [
  {
    id: 'set-image-dimensions',
    name: 'Set Image Dimensions',
    description: 'Add width and height attributes to all images to prevent layout shifts',
    category: 'visual-stability',
    priority: 'critical',
    implementation: 'automatic',
    impact: 'high',
    effort: 'low',
    status: 'not-implemented'
  },
  {
    id: 'reserve-space-for-ads',
    name: 'Reserve Space for Dynamic Content',
    description: 'Allocate space for ads, embeds, and other dynamic content before loading',
    category: 'visual-stability',
    priority: 'high',
    implementation: 'manual',
    impact: 'high',
    effort: 'medium',
    status: 'not-implemented'
  },
  {
    id: 'avoid-including-content-above',
    name: 'Avoid Inserting Content Above Existing Content',
    description: 'Prevent DOM insertions above existing content unless responding to user interaction',
    category: 'visual-stability',
    priority: 'medium',
    implementation: 'manual',
    impact: 'medium',
    effort: 'low',
    status: 'not-implemented'
  }
];

// 优化检测 Hook
export const useOptimizationDetector = () => {
  const [detectedIssues, setDetectedIssues] = useState<OptimizationStrategy[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const scanForOptimizations = useCallback(async () => {
    setIsScanning(true);
    const issues: OptimizationStrategy[] = [];

    // 检测图片优化
    const images = document.querySelectorAll('img');
    const imagesWithoutDimensions = Array.from(images).filter(img => !img.width || !img.height);
    const imagesWithoutLazyLoading = Array.from(images).filter(img => !img.loading && !img.complete);

    if (imagesWithoutDimensions.length > 0) {
      const strategy = CLSOptimizations.find(s => s.id === 'set-image-dimensions');
      if (strategy) {
        issues.push({
          ...strategy,
          description: `Found ${imagesWithoutDimensions.length} images without dimensions`
        });
      }
    }

    // 检测预加载链接
    const preloadLinks = document.querySelectorAll('link[rel="preload"]');
    if (preloadLinks.length === 0) {
      const strategy = LCPOptimizations.find(s => s.id === 'preload-critical-resources');
      if (strategy) {
        issues.push(strategy);
      }
    }

    // 检测渲染阻塞资源
    const blockingScripts = document.querySelectorAll('script[src]:not([async]):not([defer])');
    const blockingStyles = document.querySelectorAll('link[rel="stylesheet"][media="all"]');

    if (blockingScripts.length > 0 || blockingStyles.length > 0) {
      const strategy = LCPOptimizations.find(s => s.id === 'remove-render-blocking');
      if (strategy) {
        issues.push({
          ...strategy,
          description: `Found ${blockingScripts.length} blocking scripts and ${blockingStyles.length} blocking stylesheets`
        });
      }
    }

    // 检测字体优化
    const fontDisplay = document.querySelector('style');
    if (fontDisplay && !fontDisplay.textContent?.includes('font-display')) {
      issues.push({
        id: 'optimize-font-loading',
        name: 'Optimize Font Loading',
        description: 'Use font-display: swap for custom fonts to improve loading performance',
        category: 'loading',
        priority: 'medium',
        implementation: 'manual',
        impact: 'medium',
        effort: 'low',
        status: 'not-implemented',
        code: '@font-face { font-family: "Custom Font"; src: url("font.woff2") format("woff2"); font-display: swap; }'
      });
    }

    // 检测关键CSS
    const criticalCSS = document.querySelector('style[data-critical]');
    if (!criticalCSS) {
      issues.push({
        id: 'inline-critical-css',
        name: 'Inline Critical CSS',
        description: 'Inline critical CSS to render above-the-fold content quickly',
        category: 'loading',
        priority: 'high',
        implementation: 'manual',
        impact: 'high',
        effort: 'high',
        status: 'not-implemented'
      });
    }

    setDetectedIssues(issues);
    setIsScanning(false);
  }, []);

  return {
    detectedIssues,
    isScanning,
    scanForOptimizations
  };
};

// 优化策略组件
interface OptimizationCardProps {
  strategy: OptimizationStrategy;
  onImplement?: (strategy: OptimizationStrategy) => void;
  onSkip?: (strategy: OptimizationStrategy) => void;
}

const OptimizationCard: React.FC<OptimizationCardProps> = ({
  strategy,
  onImplement,
  onSkip
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'loading': return <RocketLaunchIcon className="w-5 h-5" />;
      case 'interactivity': return <BoltIcon className="w-5 h-5" />;
      case 'visual-stability': return <ShieldCheckIcon className="w-5 h-5" />;
      case 'accessibility': return <InformationCircleIcon className="w-5 h-5" />;
      default: return <CogIcon className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-red-200 bg-red-50 text-red-700';
      case 'high': return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'medium': return 'border-yellow-200 bg-yellow-50 text-yellow-700';
      case 'low': return 'border-green-200 bg-green-50 text-green-700';
      default: return 'border-gray-200 bg-gray-50 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'implemented': return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'in-progress': return <ArrowPathIcon className="w-5 h-5 text-yellow-500 animate-spin" />;
      default: return <ExclamationTriangleIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const canAutoImplement = strategy.implementation === 'automatic';
  const isImplemented = strategy.status === 'implemented';

  return (
    <motion.div
      className={cn(
        'bg-white border-2 rounded-lg p-6 cursor-pointer transition-all',
        getPriorityColor(strategy.priority),
        isImplemented && 'opacity-60'
      )}
      onClick={() => setIsExpanded(!isExpanded)}
      whileHover={{ scale: 1.02 }}
      layout
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {getCategoryIcon(strategy.category)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {strategy.name}
            </h3>
            {getStatusIcon(strategy.status)}
          </div>
          <p className="text-gray-600 mb-3">{strategy.description}</p>

          {/* 标签 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={cn(
              'px-2 py-1 rounded text-xs font-medium',
              getPriorityColor(strategy.priority)
            )}>
              {strategy.priority.toUpperCase()}
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
              Impact: {strategy.impact}
            </span>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              Effort: {strategy.effort}
            </span>
            {canAutoImplement && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                AUTO
              </span>
            )}
          </div>

          {/* 操作按钮 */}
          {!isImplemented && (
            <div className="flex gap-2">
              {canAutoImplement && onImplement && (
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onImplement(strategy);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Implement
                </motion.button>
              )}
              {onSkip && (
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkip(strategy);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Skip
                </motion.button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 展开内容 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="mt-4 pt-4 border-t border-gray-200"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {strategy.code && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Example Code:</h4>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{strategy.code}</code>
                </pre>
              </div>
            )}
            {strategy.resources && strategy.resources.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Resources:</h4>
                <ul className="space-y-1">
                  {strategy.resources.map((resource, index) => (
                    <li key={index}>
                      <a
                        href={resource}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {resource}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// 主要优化器组件
interface CoreWebVitalsOptimizerProps {
  className?: string;
  autoScan?: boolean;
}

export const CoreWebVitalsOptimizer: React.FC<CoreWebVitalsOptimizerProps> = ({
  className = '',
  autoScan = false
}) => {
  const [activeTab, setActiveTab] = useState<'loading' | 'interactivity' | 'visual-stability'>('loading');
  const [strategies, setStrategies] = useState<OptimizationStrategy[]>([
    ...LCPOptimizations,
    ...FIDOptimizations,
    ...CLSOptimizations
  ]);
  const [implementedCount, setImplementedCount] = useState(0);

  const { detectedIssues, isScanning, scanForOptimizations } = useOptimizationDetector();

  useEffect(() => {
    if (autoScan) {
      scanForOptimizations();
    }
  }, [autoScan, scanForOptimizations]);

  useEffect(() => {
    const count = strategies.filter(s => s.status === 'implemented').length;
    setImplementedCount(count);
  }, [strategies]);

  const handleImplementStrategy = useCallback((strategy: OptimizationStrategy) => {
    setStrategies(prev => prev.map(s =>
      s.id === strategy.id ? { ...s, status: 'in-progress' } : s
    ));

    // 模拟实现过程
    setTimeout(() => {
      setStrategies(prev => prev.map(s =>
        s.id === strategy.id ? { ...s, status: 'implemented' } : s
      ));
    }, 2000);
  }, []);

  const handleSkipStrategy = useCallback((strategy: OptimizationStrategy) => {
    setStrategies(prev => prev.map(s =>
      s.id === strategy.id ? { ...s, status: 'implemented' } : s
    ));
  }, []);

  const getStrategiesByCategory = useCallback((category: string) => {
    return strategies.filter(s => s.category === category);
  }, [strategies]);

  const getTabContent = useCallback(() => {
    const allStrategies = getStrategiesByCategory(activeTab);
    const detectedStrategies = detectedIssues.filter(d => d.category === activeTab);

    // 合并检测到的问题和预设策略
    const combinedStrategies = [
      ...detectedStrategies,
      ...allStrategies.filter(s => !detectedStrategies.some(d => d.id === s.id))
    ];

    return combinedStrategies;
  }, [activeTab, getStrategiesByCategory, detectedIssues]);

  const tabs = [
    { id: 'loading', label: 'Loading Performance', icon: <RocketLaunchIcon className="w-4 h-4" /> },
    { id: 'interactivity', label: 'Interactivity', icon: <BoltIcon className="w-4 h-4" /> },
    { id: 'visual-stability', label: 'Visual Stability', icon: <ShieldCheckIcon className="w-4 h-4" /> }
  ];

  const completionPercentage = Math.round((implementedCount / strategies.length) * 100);

  return (
    <div className={cn('space-y-6', className)}>
      {/* 标题和进度 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LightBulbIcon className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-bold text-gray-900">Core Web Vitals Optimizer</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {implementedCount}/{strategies.length} implemented
          </div>
          <motion.button
            onClick={scanForOptimizations}
            disabled={isScanning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            whileHover={{ scale: isScanning ? 1 : 1.05 }}
            whileTap={{ scale: isScanning ? 1 : 0.95 }}
          >
            {isScanning ? (
              <>
                <ArrowPathIcon className="w-4 h-4 inline mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <ChartBarIcon className="w-4 h-4 inline mr-2" />
                Scan Issues
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* 进度条 */}
      <motion.div
        className="bg-gray-50 rounded-lg p-6 border border-gray-200"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Optimization Progress</h3>
          <span className="text-2xl font-bold text-blue-600">{completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-green-500 rounded-full h-3"
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <div className="mt-3 text-sm text-gray-600">
          {completionPercentage === 100 ? '🎉 All optimizations implemented!' :
           completionPercentage >= 75 ? 'Great progress! Almost there.' :
           completionPercentage >= 50 ? 'Good progress! Keep going.' :
           'Just getting started. Pick a strategy to implement.'}
        </div>
      </motion.div>

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 检测到的问题 */}
      {detectedIssues.length > 0 && (
        <motion.div
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">
              Detected {detectedIssues.length} Performance Issues
            </h3>
          </div>
          <p className="text-yellow-700 text-sm">
            We found specific issues that need attention. Check the optimization cards below for details.
          </p>
        </motion.div>
      )}

      {/* 优化策略列表 */}
      <div className="space-y-4">
        {getTabContent().map((strategy) => (
          <OptimizationCard
            key={strategy.id}
            strategy={strategy}
            onImplement={handleImplementStrategy}
            onSkip={handleSkipStrategy}
          />
        ))}
      </div>

      {/* 空状态 */}
      {getTabContent().length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No strategies available</p>
          <p className="text-sm">Try scanning for issues or check another category.</p>
        </div>
      )}
    </div>
  );
};

export default CoreWebVitalsOptimizer;