'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  CursorArrowRaysIcon,
  ClockIcon,
  LightBulbIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';

import EnhancedDashboard from './EnhancedDashboard';
import OfferPerformanceRadar from './OfferPerformanceRadar';
import TimeRangeSelector from './TimeRangeSelector';
import type { TimeRange } from './TimeRangeSelector';
import RealTimeDataUpdater from './RealTimeDataUpdater';
import { TrendChart } from './TrendChart';
import { PerformanceBarChart } from './PerformanceBarChart';
import { DistributionDonutChart } from './DistributionDonutChart';

const DataVisualizationShowcase: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('last30days');
  const [realTimeMode, setRealTimeMode] = useState(false);

  // 模拟实时数据源
  const mockRealTimeDataSource = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟网络延迟
    const newValue = Math.floor(Math.random() * 5000) + 10000;
    const newOrders = Math.floor(Math.random() * 50) + 100;

    return {
      timestamp: Date.now(),
      value: {
        revenue: newValue,
        orders: newOrders,
        ctr: (Math.random() * 2 + 1).toFixed(2),
        conversions: Math.floor(Math.random() * 30) + 50,
      },
    };
  };

  const sampleRadarData = [
    { metric: '广告ROI', value: 4.2, fullMark: 5, benchmark: 3.5 },
    { metric: '转化率', value: 3.8, fullMark: 5, benchmark: 3.2 },
    { metric: '点击率', value: 2.9, fullMark: 5, benchmark: 2.5 },
    { metric: '质量评分', value: 4.1, fullMark: 5, benchmark: 3.8 },
    { metric: '预算利用率', value: 3.6, fullMark: 5, benchmark: 3.0 },
    { metric: '受众覆盖率', value: 3.2, fullMark: 5, benchmark: 2.8 },
  ];

  const sampleTrendData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      revenue: Math.floor(Math.random() * 10000) + 5000,
      orders: Math.floor(Math.random() * 100) + 50,
      ctr: (Math.random() * 2 + 1).toFixed(2),
    };
  });

  const sampleBarData = [
    { name: 'Google Ads', conversions: 245, cost: 3200, roas: 4.2 },
    { name: 'Facebook Ads', conversions: 189, cost: 2100, roas: 3.8 },
    { name: 'TikTok Ads', conversions: 156, cost: 1800, roas: 3.4 },
    { name: '微信广告', conversions: 134, cost: 1500, roas: 3.6 },
    { name: '小红书', conversions: 98, cost: 900, roas: 4.1 },
  ];

  const sampleDonutData = [
    { name: '搜索广告', value: 35, color: '#3b82f6' },
    { name: '社交广告', value: 28, color: '#10b981' },
    { name: '展示广告', value: 22, color: '#f59e0b' },
    { name: '视频广告', value: 15, color: '#8b5cf6' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold text-gradient-primary mb-4">
            数据可视化展示
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            体验Google-Monetize的现代化数据可视化系统，包括实时数据更新、交互式图表和高级分析功能
          </p>
        </motion.div>

        {/* 功能特性展示 */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {[
            {
              icon: ChartBarIcon,
              title: '交互式图表',
              description: '丰富的图表类型和交互体验',
              color: 'blue',
            },
            {
              icon: ClockIcon,
              title: '实时更新',
              description: '数据实时同步，动态展示',
              color: 'green',
            },
            {
              icon: CursorArrowRaysIcon,
              title: '智能分析',
              description: 'AI驱动的数据洞察和建议',
              color: 'purple',
            },
            {
              icon: LightBulbIcon,
              title: '性能雷达',
              description: '多维度性能评估体系',
              color: 'yellow',
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <div className={`w-12 h-12 bg-${feature.color}-100 dark:bg-${feature.color}-900/20 rounded-lg flex items-center justify-center mx-auto mb-4`}>
                <feature.icon className={`h-6 w-6 text-${feature.color}-600 dark:text-${feature.color}-400`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* 控制面板 */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <RocketLaunchIcon className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                控制面板
              </h3>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">实时模式:</span>
                <button
                  onClick={() => setRealTimeMode(!realTimeMode)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    realTimeMode
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {realTimeMode ? '开启' : '关闭'}
                </button>
              </div>

              <TimeRangeSelector
                value={selectedTimeRange}
                onChange={(range) => setSelectedTimeRange(range as any)}
                compact={true}
              />
            </div>
          </div>
        </motion.div>

        {/* 主要Dashboard */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <EnhancedDashboard
            timeRange={selectedTimeRange}
            onTimeRangeChange={setSelectedTimeRange}
            realTimeUpdates={realTimeMode}
            showAnimations={true}
          />
        </motion.div>

        {/* 图表展示区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* 性能雷达图 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <OfferPerformanceRadar
              data={sampleRadarData}
              title="广告性能雷达"
              subtitle="多维度分析您的广告投放效果"
              showBenchmark={true}
              interactive={true}
            />
          </motion.div>

          {/* 实时数据监控 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                实时数据监控
              </h3>

              <RealTimeDataUpdater
                dataSource={mockRealTimeDataSource}
                config={{ updateInterval: 2000, maxDataPoints: 20 }}
                showControls={true}
                showStatus={true}
              >
                {(data, controls) => (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">当前收入</div>
                        <div className="text-2xl font-bold text-primary">
                          ¥{data[data.length - 1]?.value.revenue.toLocaleString() || '0'}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">点击率</div>
                        <div className="text-2xl font-bold text-green-600">
                          {data[data.length - 1]?.value.ctr || '0'}%
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                      数据点: {data.length} / 20 |
                      状态: {controls.status === 'connected' ? '已连接' : '未连接'}
                    </div>
                  </div>
                )}
              </RealTimeDataUpdater>
            </div>
          </motion.div>
        </div>

        {/* 更多图表示例 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              图表组件库
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 趋势图 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  收入趋势
                </h4>
                <TrendChart
                  data={sampleTrendData}
                  categories={['revenue', 'orders']}
                  colors={['blue', 'green']}
                  className="h-64"
                />
              </div>

              {/* 柱状图 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  渠道对比
                </h4>
                <PerformanceBarChart
                  data={sampleBarData}
                  categories={['conversions', 'cost']}
                  colors={['blue', 'green']}
                  className="h-64"
                />
              </div>

              {/* 环形图 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  类型分布
                </h4>
                <DistributionDonutChart
                  data={sampleDonutData}
                  className="h-64"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* 底部提示 */}
        <motion.div
          className="text-center py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg">
            <LightBulbIcon className="h-5 w-5" />
            <span className="text-sm font-medium">
              所有图表支持实时数据更新和自定义配置
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DataVisualizationShowcase;