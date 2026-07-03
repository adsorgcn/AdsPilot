'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  MegaphoneIcon as AdvertisementIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendChart } from './TrendChart';
import { PerformanceBarChart } from './PerformanceBarChart';
import { DistributionDonutChart } from './DistributionDonutChart';
import OfferPerformanceRadar from './OfferPerformanceRadar';
import TimeRangeSelector from './TimeRangeSelector';
import type { TimeRange } from './TimeRangeSelector';
import { RealTimeChart } from './RealTimeDataUpdater';
import { cn } from '~/lib/utils';

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: Array<{ date: string; value: number }>;
}

interface DashboardData {
  revenue: Array<{ date: string; revenue: number; orders: number }>;
  performance: Array<{ name: string; conversions: number; cost: number; roas: number }>;
  distribution: Array<{ name: string; value: number; color: string }>;
  radarData: Array<{ metric: string; value: number; fullMark: number; benchmark: number }>;
}

interface EnhancedDashboardProps {
  className?: string;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  realTimeUpdates?: boolean;
  showAnimations?: boolean;
}

const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({
  className = '',
  timeRange = 'last30days',
  onTimeRangeChange,
  realTimeUpdates = false,
  showAnimations = true,
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [isLoading, setIsLoading] = useState(false);

  // 模拟数据生成
  const generateMockData = useMemo((): DashboardData => {
    const generateRevenueData = () => {
      const days = selectedTimeRange === 'last7days' ? 7 : selectedTimeRange === 'last30days' ? 30 : 90;
      return Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        return {
          date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          revenue: Math.floor(Math.random() * 10000) + 5000,
          orders: Math.floor(Math.random() * 100) + 50,
        };
      });
    };

    const generatePerformanceData = () => [
      { name: 'Google Ads', conversions: 245, cost: 3200, roas: 4.2 },
      { name: 'Facebook Ads', conversions: 189, cost: 2100, roas: 3.8 },
      { name: 'TikTok Ads', conversions: 156, cost: 1800, roas: 3.4 },
      { name: '微信广告', conversions: 134, cost: 1500, roas: 3.6 },
      { name: '小红书', conversions: 98, cost: 900, roas: 4.1 },
    ];

    const generateDistributionData = () => [
      { name: '搜索广告', value: 35, color: '#3b82f6' },
      { name: '社交广告', value: 28, color: '#10b981' },
      { name: '展示广告', value: 22, color: '#f59e0b' },
      { name: '视频广告', value: 15, color: '#8b5cf6' },
    ];

    const generateRadarData = () => [
      { metric: '广告ROI', value: 4.2, fullMark: 5, benchmark: 3.5 },
      { metric: '转化率', value: 3.8, fullMark: 5, benchmark: 3.2 },
      { metric: '点击率', value: 2.9, fullMark: 5, benchmark: 2.5 },
      { metric: '质量评分', value: 4.1, fullMark: 5, benchmark: 3.8 },
      { metric: '预算利用率', value: 3.6, fullMark: 5, benchmark: 3.0 },
      { metric: '受众覆盖率', value: 3.2, fullMark: 5, benchmark: 2.8 },
    ];

    return {
      revenue: generateRevenueData(),
      performance: generatePerformanceData(),
      distribution: generateDistributionData(),
      radarData: generateRadarData(),
    };
  }, [selectedTimeRange]);

  const data = generateMockData;

  // 计算指标卡片数据
  const metricCards: MetricCard[] = useMemo(() => {
    const totalRevenue = data.revenue.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = data.revenue.reduce((sum, item) => sum + item.orders, 0);
    const avgROAS = data.performance.reduce((sum, item) => sum + item.roas, 0) / data.performance.length;
    const totalConversions = data.performance.reduce((sum, item) => sum + item.conversions, 0);

    return [
      {
        title: '总收入',
        value: `¥${(totalRevenue / 1000).toFixed(1)}K`,
        change: 12.5,
        changeType: 'increase',
        icon: CurrencyDollarIcon,
        description: '较上期增长',
      },
      {
        title: '订单数量',
        value: totalOrders.toLocaleString(),
        change: 8.3,
        changeType: 'increase',
        icon: UserGroupIcon,
        description: '较上期增长',
      },
      {
        title: '平均ROAS',
        value: avgROAS.toFixed(2),
        change: -2.1,
        changeType: 'decrease',
        icon: AdvertisementIcon,
        description: '较上期变化',
      },
      {
        title: '总转化数',
        value: totalConversions.toLocaleString(),
        change: 15.7,
        changeType: 'increase',
        icon: ChartBarIcon,
        description: '较上期增长',
      },
    ];
  }, [data]);

  // 处理时间范围变化
  const handleTimeRangeChange = (range: TimeRange) => {
    setIsLoading(true);
    setSelectedTimeRange(range);
    onTimeRangeChange?.(range);

    // 模拟加载延迟
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  // 渲染指标卡片
  const renderMetricCard = (card: MetricCard, index: number) => (
    <motion.div
      key={card.title}
      className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
      initial={showAnimations ? { opacity: 0, y: 20 } : {}}
      animate={showAnimations ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {card.icon && (
              <card.icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            )}
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {card.title}
            </h3>
          </div>

          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {card.value}
          </div>

          <div className="flex items-center gap-2">
            {card.change !== undefined && (
              <div className={cn(
                'flex items-center gap-1 text-sm font-medium',
                card.changeType === 'increase' ? 'text-green-600 dark:text-green-400' :
                card.changeType === 'decrease' ? 'text-red-600 dark:text-red-400' :
                'text-gray-600 dark:text-gray-400'
              )}>
                {card.changeType === 'increase' ? (
                  <ArrowTrendingUpIcon className="h-4 w-4" />
                ) : card.changeType === 'decrease' ? (
                  <ArrowTrendingDownIcon className="h-4 w-4" />
                ) : null}
                <span>{Math.abs(card.change)}%</span>
              </div>
            )}
            {card.description && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {card.description}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* 时间范围选择器 */}
      <motion.div
        className="flex justify-between items-center"
        initial={showAnimations ? { opacity: 0, y: -20 } : {}}
        animate={showAnimations ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            广告效果分析
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            实时监控您的广告投放效果
          </p>
        </div>

        <div className="flex items-center gap-4">
          <TimeRangeSelector
            value={selectedTimeRange}
            onChange={handleTimeRangeChange}
            compact={true}
          />

          {realTimeUpdates && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">实时更新</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* 加载状态 */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="flex items-center justify-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLoading && (
        <>
          {/* 指标卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metricCards.map(renderMetricCard)}
          </div>

          {/* 图表区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 收入趋势图 */}
            <motion.div
              className="lg:col-span-2"
              initial={showAnimations ? { opacity: 0, scale: 0.95 } : {}}
              animate={showAnimations ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  收入趋势
                </h3>

                {realTimeUpdates ? (
                  <RealTimeChart
                    dataSource={async () => {
                      // 模拟实时数据
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      const newRevenue = Math.floor(Math.random() * 2000) + 8000;
                      const newOrders = Math.floor(Math.random() * 30) + 70;
                      return {
                        timestamp: Date.now(),
                        value: { revenue: newRevenue, orders: newOrders },
                      };
                    }}
                    config={{ updateInterval: 3000, maxDataPoints: 20 }}
                    ChartComponent={({ data }) => (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={data.map(point => ({
                          date: new Date(point.timestamp).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }),
                          revenue: point.value.revenue,
                          orders: point.value.orders,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis yAxisId="revenue" />
                          <YAxis yAxisId="orders" orientation="right" />
                          <Tooltip />
                          <Area
                            yAxisId="revenue"
                            type="monotone"
                            dataKey="revenue"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.2}
                          />
                          <Area
                            yAxisId="orders"
                            type="monotone"
                            dataKey="orders"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  />
                ) : (
                  <TrendChart
                    data={data.revenue}
                    categories={['revenue', 'orders']}
                    colors={['blue', 'green']}
                    valueFormatter={(value) => typeof value === 'number' ? value.toLocaleString() : value}
                    className="h-80"
                  />
                )}
              </div>
            </motion.div>

            {/* 性能对比图 */}
            <motion.div
              initial={showAnimations ? { opacity: 0, x: -20 } : {}}
              animate={showAnimations ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  渠道性能对比
                </h3>
                <PerformanceBarChart
                  data={data.performance}
                  categories={['conversions', 'cost']}
                  colors={['blue', 'green']}
                  className="h-72"
                />
              </div>
            </motion.div>

            {/* 分布图 */}
            <motion.div
              initial={showAnimations ? { opacity: 0, x: 20 } : {}}
              animate={showAnimations ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  广告类型分布
                </h3>
                <DistributionDonutChart
                  data={data.distribution}
                  className="h-72"
                />
              </div>
            </motion.div>
          </div>

          {/* 雷达图 */}
          <motion.div
            initial={showAnimations ? { opacity: 0, y: 20 } : {}}
            animate={showAnimations ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <OfferPerformanceRadar
              data={data.radarData}
              title="综合性能分析"
              subtitle="基于关键指标的全面评估"
              showBenchmark={true}
              size="lg"
            />
          </motion.div>
        </>
      )}
    </div>
  );
};

export default EnhancedDashboard;