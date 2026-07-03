'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PageLayout } from '~/core/ui/PageLayout';
import { PerformanceMonitor } from './PerformanceMonitor';
import { PerformanceProfiler } from './PerformanceProfiler';
import { CoreWebVitalsOptimizer } from './CoreWebVitalsOptimizer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/core/ui/tabs';
import {
  ChartBarIcon,
  ClockIcon,
  LightBulbIcon,
  DocumentTextIcon,
  PlayIcon,
  ArrowTrendingUpIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';

export default function PerformanceShowcase() {
  const [activeDemo, setActiveDemo] = useState<'monitor' | 'profiler' | 'optimizer'>('monitor');

  const demoTabs = [
    {
      id: 'monitor',
      label: 'Performance Monitor',
      icon: <ChartBarIcon className="w-4 h-4" />,
      description: 'Real-time performance metrics and Core Web Vitals monitoring'
    },
    {
      id: 'profiler',
      label: 'Performance Profiler',
      icon: <ClockIcon className="w-4 h-4" />,
      description: 'Function-level performance profiling and analysis'
    },
    {
      id: 'optimizer',
      label: 'CWV Optimizer',
      icon: <LightBulbIcon className="w-4 h-4" />,
      description: 'Automated Core Web Vitals optimization suggestions'
    }
  ];

  return (
    <PageLayout>
      <div className="flex flex-col gap-8">
        {/* 标题部分 */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Performance Monitoring Suite
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Comprehensive performance monitoring, profiling, and optimization tools for your web applications.
            Track Core Web Vitals, analyze performance bottlenecks, and implement optimizations.
          </p>
        </motion.div>

        {/* 功能卡片 */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <ChartBarIcon className="w-8 h-8" />
              <h3 className="text-xl font-semibold">Real-time Monitoring</h3>
            </div>
            <p className="opacity-90 mb-4">
              Track Core Web Vitals, memory usage, network conditions, and device information in real-time.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                LCP, FID, CLS, FCP, TTFB, INP metrics
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Memory usage monitoring with pressure detection
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Network and device information
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <ClockIcon className="w-8 h-8" />
              <h3 className="text-xl font-semibold">Performance Profiling</h3>
            </div>
            <p className="opacity-90 mb-4">
              Deep dive into function performance, render times, and execution patterns.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Function-level performance tracking
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                React component render profiling
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Performance data export and analysis
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <LightBulbIcon className="w-8 h-8" />
              <h3 className="text-xl font-semibold">Auto Optimization</h3>
            </div>
            <p className="opacity-90 mb-4">
              Automated detection and implementation of performance optimizations.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Core Web Vitals optimization suggestions
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Automatic and manual implementation options
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Progress tracking and code examples
              </li>
            </ul>
          </div>
        </motion.div>

        {/* 交互式演示 */}
        <motion.div
          className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Interactive Demo</h2>
            <p className="text-gray-600">Try out the performance monitoring tools in real-time</p>
          </div>

          <Tabs value={activeDemo} onValueChange={(value) => setActiveDemo(value as any)} className="p-6">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              {demoTabs.map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="monitor" className="mt-0">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Performance Monitor</h3>
                  <p className="text-blue-700 text-sm mb-4">
                    Real-time monitoring of Core Web Vitals and system performance metrics.
                    The monitor automatically starts tracking when enabled.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded">
                      <ChartBarIcon className="w-3 h-3" />
                      LCP, FID, CLS
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded">
                      <CpuChipIcon className="w-3 h-3" />
                      Memory Usage
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded">
                      <RocketLaunchIcon className="w-3 h-3" />
                      Network Info
                    </div>
                  </div>
                </div>
                <PerformanceMonitor autoStart={true} showDetails={true} />
              </div>
            </TabsContent>

            <TabsContent value="profiler" className="mt-0">
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-2">Performance Profiler</h3>
                  <p className="text-purple-700 text-sm mb-4">
                    Function-level performance profiling with detailed execution tracking.
                    Start profiling to see performance metrics for function calls and renders.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded">
                      <ClockIcon className="w-3 h-3" />
                      Function Timing
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded">
                      <PlayIcon className="w-3 h-3" />
                      Render Profiling
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded">
                      <DocumentTextIcon className="w-3 h-3" />
                      Export Data
                    </div>
                  </div>
                </div>
                <PerformanceProfiler autoCapture={false} />
              </div>
            </TabsContent>

            <TabsContent value="optimizer" className="mt-0">
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-2">Core Web Vitals Optimizer</h3>
                  <p className="text-green-700 text-sm mb-4">
                    Automated optimization suggestions for improving Core Web Vitals scores.
                    Scan your page to detect issues and get implementation guidance.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded">
                      <LightBulbIcon className="w-3 h-3" />
                      Auto Detection
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded">
                      <ArrowTrendingUpIcon className="w-3 h-3" />
                      Implementation Guide
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded">
                      <ShieldCheckIcon className="w-3 h-3" />
                      Best Practices
                    </div>
                  </div>
                </div>
                <CoreWebVitalsOptimizer autoScan={true} />
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* 技术特性 */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Core Web Vitals Support</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">LCP</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Largest Contentful Paint</div>
                  <div className="text-sm text-gray-600">Loading performance measurement</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-bold text-green-600">FID</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">First Input Delay</div>
                  <div className="text-sm text-gray-600">Interactivity measurement</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-600">CLS</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Cumulative Layout Shift</div>
                  <div className="text-sm text-gray-600">Visual stability measurement</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Features</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <ChartBarIcon className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Real-time Dashboard</div>
                  <div className="text-sm text-gray-600">Live performance metrics and alerts</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DocumentTextIcon className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="font-medium text-gray-900">Detailed Reports</div>
                  <div className="text-sm text-gray-600">Export and analyze performance data</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheckIcon className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">Optimization Engine</div>
                  <div className="text-sm text-gray-600">Automated improvement suggestions</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 使用说明 */}
        <motion.div
          className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How to Use</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Monitor Performance</h4>
                <p className="text-sm text-gray-600">
                  Start the performance monitor to track real-time metrics and identify bottlenecks.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Profile Issues</h4>
                <p className="text-sm text-gray-600">
                  Use the profiler to dive deep into function performance and execution patterns.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Implement Optimizations</h4>
                <p className="text-sm text-gray-600">
                  Apply suggested optimizations and track improvements in your Core Web Vitals scores.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </PageLayout>
  );
}