'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { cn } from '~/lib/utils';

interface RadarDataPoint {
  metric: string;
  value: number;
  fullMark: number;
  benchmark?: number;
}

interface OfferPerformanceRadarProps {
  data: RadarDataPoint[];
  title?: string;
  subtitle?: string;
  showLegend?: boolean;
  showBenchmark?: boolean;
  colors?: {
    primary: string;
    benchmark: string;
    grid: string;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  interactive?: boolean;
  animationDuration?: number;
}

const defaultColors = {
  primary: '#3b82f6',
  benchmark: '#10b981',
  grid: '#e5e7eb',
};

const sizeConfig = {
  sm: { height: 250, fontSize: 12 },
  md: { height: 350, fontSize: 14 },
  lg: { height: 450, fontSize: 16 },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const benchmark = payload[1];

    return (
      <motion.div
        className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <p className="font-medium text-gray-900 dark:text-white mb-2">
          {label}
        </p>
        <div className="space-y-1">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            当前: {data.value}
          </p>
          {benchmark && (
            <p className="text-sm text-green-600 dark:text-green-400">
              基准: {benchmark.value}
            </p>
          )}
        </div>
      </motion.div>
    );
  }
  return null;
};

const OfferPerformanceRadar: React.FC<OfferPerformanceRadarProps> = ({
  data,
  title,
  subtitle,
  showLegend = true,
  showBenchmark = true,
  colors = defaultColors,
  size = 'md',
  className = '',
  interactive = true,
  animationDuration = 1000,
}) => {
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  const config = sizeConfig[size];

  // 处理数据
  const processedData = useMemo(() => {
    return data.map(item => ({
      metric: item.metric,
      value: item.value,
      benchmark: showBenchmark && item.benchmark ? item.benchmark : undefined,
      fullMark: item.fullMark,
    }));
  }, [data, showBenchmark]);

  // 计算性能评分
  const performanceScore = useMemo(() => {
    const totalScore = data.reduce((sum, item) => {
      return sum + (item.value / item.fullMark) * 100;
    }, 0);
    return Math.round(totalScore / data.length);
  }, [data]);

  // 获取等级
  const getPerformanceGrade = (score: number) => {
    if (score >= 90) return { grade: 'A+', color: 'text-green-600 dark:text-green-400' };
    if (score >= 80) return { grade: 'A', color: 'text-green-600 dark:text-green-400' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-600 dark:text-blue-400' };
    if (score >= 60) return { grade: 'C', color: 'text-yellow-600 dark:text-yellow-400' };
    return { grade: 'D', color: 'text-red-600 dark:text-red-400' };
  };

  const gradeInfo = getPerformanceGrade(performanceScore);

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg', className)}>
      {/* 标题区域 */}
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* 性��评分展示 */}
      <div className="flex items-center justify-center mb-6">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
            {performanceScore}
          </div>
          <div className={cn('text-sm font-medium', gradeInfo.color)}>
            {gradeInfo.grade} 级性能
          </div>
        </motion.div>
      </div>

      {/* 雷达图 */}
      <div style={{ height: config.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={processedData}>
            <PolarGrid
              gridType="polygon"
              stroke={colors.grid}
              strokeWidth={1}
              radialLines={true}
            />

            <PolarAngleAxis
              dataKey="metric"
              tick={{ fontSize: config.fontSize, fill: '#6b7280' }}
              className="font-medium"
            />

            <PolarRadiusAxis
              domain={[0, 'dataMax']}
              tick={{ fontSize: config.fontSize - 2, fill: '#9ca3af' }}
              tickCount={5}
              axisLine={false}
            />

            {/* 主要数据雷达图 */}
            <Radar
              name="当前性能"
              dataKey="value"
              stroke={colors.primary}
              fill={colors.primary}
              fillOpacity={0.3}
              strokeWidth={2}
              animationDuration={animationDuration}
              animationEasing="ease-out"
            />

            {/* 基准对比雷达图 */}
            {showBenchmark && (
              <Radar
                name="基准性能"
                dataKey="benchmark"
                stroke={colors.benchmark}
                fill={colors.benchmark}
                fillOpacity={0.1}
                strokeWidth={2}
                strokeDasharray="5 5"
                animationDuration={animationDuration}
                animationEasing="ease-out"
              />
            )}

            <Tooltip content={<CustomTooltip />} />

            {showLegend && (
              <Legend
                wrapperStyle={{
                  fontSize: config.fontSize,
                  paddingTop: '20px',
                }}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 详细指标列表 */}
      <div className="mt-6 space-y-3">
        {data.map((item, index) => (
          <motion.div
            key={item.metric}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            onMouseEnter={() => interactive && setHoveredMetric(item.metric)}
            onMouseLeave={() => interactive && setHoveredMetric(null)}
            style={{
              backgroundColor: hoveredMetric === item.metric ?
                'rgba(59, 130, 246, 0.1)' :
                undefined,
              transform: hoveredMetric === item.metric ? 'scale(1.02)' : 'scale(1)',
              transition: 'all 0.2s ease',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="font-medium text-sm text-gray-900 dark:text-white">
                {item.metric}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {showBenchmark && item.benchmark && (
                <div className="text-right">
                  <div className="text-xs text-gray-500 dark:text-gray-400">基准</div>
                  <div className="text-sm font-medium text-green-600 dark:text-green-400">
                    {item.benchmark}
                  </div>
                </div>
              )}

              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400">当前</div>
                <div className="text-sm font-bold text-primary">
                  {item.value}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400">完成度</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {Math.round((item.value / item.fullMark) * 100)}%
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 性能建议 */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          性能建议
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          {data
            .filter(item => (item.value / item.fullMark) < 0.8)
            .slice(0, 3)
            .map(item => (
              <li key={item.metric} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-2 flex-shrink-0" />
                <span>
                  提升 <strong>{item.metric}</strong> 至 {Math.round(item.fullMark * 0.8)} 以上
                </span>
              </li>
            ))}
          {data.filter(item => (item.value / item.fullMark) >= 0.8).length === data.length && (
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-green-600 dark:bg-green-400 mt-2 flex-shrink-0" />
              <span>所有指标表现优秀，继续保持！</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default OfferPerformanceRadar;