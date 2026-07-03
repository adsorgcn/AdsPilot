'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePerformanceMetrics } from '~/core/state/GlobalStateProvider';

// 性能分析结果接口
interface PerformanceAnalysisResult {
  // 核心Web指标
  coreWebVitals: {
    fcp: { value: number; grade: 'A' | 'B' | 'C' | 'D'; status: 'good' | 'needs-improvement' | 'poor' };
    lcp: { value: number; grade: 'A' | 'B' | 'C' | 'D'; status: 'good' | 'needs-improvement' | 'poor' };
    cls: { value: number; grade: 'A' | 'B' | 'C' | 'D'; status: 'good' | 'needs-improvement' | 'poor' };
    fid: { value: number; grade: 'A' | 'B' | 'C' | 'D'; status: 'good' | 'needs-improvement' | 'poor' };
  };

  // 资源性能
  resourceMetrics: {
    bundleSize: number;
    unusedJavaScript: number;
    unusedCSS: number;
    imageOptimization: number;
    fontOptimization: number;
  };

  // 运行时性能
  runtimeMetrics: {
    memoryUsage: number;
    renderTime: number;
    apiResponseTime: number;
    errorRate: number;
  };

  // 优化建议
  recommendations: Array<{
    category: 'critical' | 'important' | 'moderate';
    title: string;
    description: string;
    estimatedImpact: 'high' | 'medium' | 'low';
    implementation: string;
  }>;

  // 总体评分
  overallScore: number;
  optimizationLevel: 'excellent' | 'good' | 'needs-work' | 'poor';
}

// 性能阈值配置
const PERFORMANCE_THRESHOLDS = {
  fcp: { good: 1800, needsImprovement: 3000 },
  lcp: { good: 2500, needsImprovement: 4000 },
  cls: { good: 0.1, needsImprovement: 0.25 },
  fid: { good: 100, needsImprovement: 300 },
  bundleSize: { good: 1000000, needsImprovement: 2000000 }, // 1MB - 2MB
  memoryUsage: { good: 50000000, needsImprovement: 100000000 }, // 50MB - 100MB
  apiResponseTime: { good: 200, needsImprovement: 500 }, // 200ms - 500ms
};

// 高级性能分析Hook
export function useAdvancedAnalytics() {
  const { getMetrics, recordInteraction } = usePerformanceMetrics();
  const [analysisResult, setAnalysisResult] = useState<PerformanceAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisTimeoutRef = useRef<NodeJS.Timeout>();

  // 获取核心Web指标
  const getCoreWebVitals = useCallback(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    const fcp = paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
    const lcp = getLargestContentfulPaint();
    const cls = getCLS();
    const fid = getFirstInputDelay();

    return {
      fcp: {
        value: fcp,
        grade: getGrade(fcp, PERFORMANCE_THRESHOLDS.fcp),
        status: getStatus(fcp, PERFORMANCE_THRESHOLDS.fcp),
      },
      lcp: {
        value: lcp,
        grade: getGrade(lcp, PERFORMANCE_THRESHOLDS.lcp),
        status: getStatus(lcp, PERFORMANCE_THRESHOLDS.lcp),
      },
      cls: {
        value: cls,
        grade: getGrade(cls, PERFORMANCE_THRESHOLDS.cls),
        status: getStatus(cls, PERFORMANCE_THRESHOLDS.cls),
      },
      fid: {
        value: fid,
        grade: getGrade(fid, PERFORMANCE_THRESHOLDS.fid),
        status: getStatus(fid, PERFORMANCE_THRESHOLDS.fid),
      },
    };
  }, []);

  // 获取最大内容绘制时间
  const getLargestContentfulPaint = (): number => {
    const entries = performance.getEntriesByType('largest-contentful-paint');
    return entries.length > 0 ? entries[entries.length - 1].startTime : 0;
  };

  // 获取累积布局偏移
  const getCLS = (): number => {
    let clsValue = 0;
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      console.warn('CLS not supported');
    }
    return clsValue;
  };

  // 获取首次输入延迟
  const getFirstInputDelay = (): number => {
    let fid = 0;
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.processingStart) {
            fid = entry.processingStart - entry.startTime;
          }
        });
      });
      observer.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      console.warn('FID not supported');
    }
    return fid;
  };

  // 获取性能等级
  const getGrade = (value: number, thresholds: { good: number; needsImprovement: number }): 'A' | 'B' | 'C' | 'D' => {
    if (value <= thresholds.good) return 'A';
    if (value <= thresholds.needsImprovement) return 'B';
    if (value <= thresholds.needsImprovement * 1.5) return 'C';
    return 'D';
  };

  // 获取性能状态
  const getStatus = (value: number, thresholds: { good: number; needsImprovement: number }): 'good' | 'needs-improvement' | 'poor' => {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  };

  // 获取资源性能指标
  const getResourceMetrics = useCallback(() => {
    const resources = performance.getEntriesByType('resource');

    // 计算包大小（简化计算）
    let bundleSize = 0;
    let imageTotalSize = 0;
    let fontTotalSize = 0;
    let cssTotalSize = 0;
    let jsTotalSize = 0;

    resources.forEach((resource: any) => {
      const size = resource.transferSize || 0;

      if (resource.name.includes('.js')) {
        jsTotalSize += size;
        bundleSize += size;
      } else if (resource.name.includes('.css')) {
        cssTotalSize += size;
        bundleSize += size;
      } else if (resource.name.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
        imageTotalSize += size;
      } else if (resource.name.match(/\.(woff|woff2|ttf|eot)$/i)) {
        fontTotalSize += size;
      }
    });

    // 简化的未使用JavaScript估算（实际中需要更复杂的分析）
    const unusedJavaScript = Math.max(0, jsTotalSize * 0.3); // 假设30%未使用

    return {
      bundleSize,
      unusedJavaScript,
      unusedCSS: Math.max(0, cssTotalSize * 0.2), // 假设20%未使用
      imageOptimization: calculateImageOptimizationScore(imageTotalSize),
      fontOptimization: calculateFontOptimizationScore(fontTotalSize),
    };
  }, []);

  // 计算图片优化分数
  const calculateImageOptimizationScore = (totalSize: number): number => {
    // 理想情况下图片应该被优化到合理大小
    const idealSize = 500000; // 500KB
    if (totalSize <= idealSize) return 100;
    return Math.max(0, 100 - ((totalSize - idealSize) / idealSize) * 50);
  };

  // 计算字体优化分数
  const calculateFontOptimizationScore = (totalSize: number): number => {
    // 理想情况下字体文件应该被压缩和预加载
    const idealSize = 200000; // 200KB
    if (totalSize <= idealSize) return 100;
    return Math.max(0, 100 - ((totalSize - idealSize) / idealSize) * 40);
  };

  // 获取运行时性能指标
  const getRuntimeMetrics = useCallback(() => {
    const metrics = getMetrics();

    // 获取内存使用情况
    let memoryUsage = 0;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = memory.usedJSHeapSize;
    }

    // 计算API响应时间
    const apiResponseTimes = Object.values(metrics.apiResponseTimes).flat();
    const avgApiResponseTime = apiResponseTimes.length > 0
      ? apiResponseTimes.reduce((sum, time) => sum + time, 0) / apiResponseTimes.length
      : 0;

    // 计算错误率
    const totalErrors = Object.values(metrics.errorCounts).reduce((sum, count) => sum + count, 0);
    const totalInteractions = metrics.userInteractions.length;
    const errorRate = totalInteractions > 0 ? (totalErrors / totalInteractions) * 100 : 0;

    return {
      memoryUsage,
      renderTime: 0, // 需要从其他地方获取
      apiResponseTime: avgApiResponseTime,
      errorRate,
    };
  }, [getMetrics]);

  // 生成优化建议
  const generateRecommendations = useCallback((
    coreWebVitals: PerformanceAnalysisResult['coreWebVitals'],
    resourceMetrics: PerformanceAnalysisResult['resourceMetrics'],
    runtimeMetrics: PerformanceAnalysisResult['runtimeMetrics']
  ): PerformanceAnalysisResult['recommendations'] => {
    const recommendations: PerformanceAnalysisResult['recommendations'] = [];

    // FCP优化建议
    if (coreWebVitals.fcp.status !== 'good') {
      recommendations.push({
        category: coreWebVitals.fcp.status === 'poor' ? 'critical' : 'important',
        title: '优化首次内容绘制时间',
        description: `当前FCP为${Math.round(coreWebVitals.fcp.value)}ms，建议优化到${PERFORMANCE_THRESHOLDS.fcp.good}ms以下`,
        estimatedImpact: coreWebVitals.fcp.status === 'poor' ? 'high' : 'medium',
        implementation: '1. 移除阻塞渲染的CSS和JavaScript\n2. 优化服务器响应时间\n3. 启用Brotli或Gzip压缩\n4. 使用CDN加速资源加载',
      });
    }

    // LCP优化建议
    if (coreWebVitals.lcp.status !== 'good') {
      recommendations.push({
        category: coreWebVitals.lcp.status === 'poor' ? 'critical' : 'important',
        title: '优化最大内容绘制时间',
        description: `当前LCP为${Math.round(coreWebVitals.lcp.value)}ms，建议优化到${PERFORMANCE_THRESHOLDS.lcp.good}ms以下`,
        estimatedImpact: coreWebVitals.lcp.status === 'poor' ? 'high' : 'medium',
        implementation: '1. 优化图片加载（WebP格式、懒加载）\n2. 预加载关键资源\n3. 移除不必要的第三方脚本\n4. 优化服务器响应时间',
      });
    }

    // CLS优化建议
    if (coreWebVitals.cls.status !== 'good') {
      recommendations.push({
        category: coreWebVitals.cls.status === 'poor' ? 'critical' : 'important',
        title: '减少累积布局偏移',
        description: `当前CLS为${coreWebVitals.cls.value.toFixed(3)}，建议优化到${PERFORMANCE_THRESHOLDS.cls.good}以下`,
        estimatedImpact: coreWebVitals.cls.status === 'poor' ? 'high' : 'medium',
        implementation: '1. 为图片和广告设置明确的尺寸\n2. 预留动态内容的空间\n3. 避免在现有内容上方插入内容\n4. 使用CSS transform代替动画',
      });
    }

    // 包大小优化建议
    if (resourceMetrics.bundleSize > PERFORMANCE_THRESHOLDS.bundleSize.needsImprovement) {
      recommendations.push({
        category: 'important',
        title: '优化JavaScript包大小',
        description: `当前包大小为${(resourceMetrics.bundleSize / 1024 / 1024).toFixed(2)}MB，建议压缩到${(PERFORMANCE_THRESHOLDS.bundleSize.good / 1024 / 1024).toFixed(2)}MB以下`,
        estimatedImpact: 'high',
        implementation: '1. 移除未使用的JavaScript (${(resourceMetrics.unusedJavaScript / 1024).toFixed(2)}KB)\n2. 使用Tree Shaking优化\n3. 启用代码分割\n4. 使用现代压缩工具',
      });
    }

    // 图片优化建议
    if (resourceMetrics.imageOptimization < 80) {
      recommendations.push({
        category: 'moderate',
        title: '优化图片资源',
        description: `图片优化评分为${resourceMetrics.imageOptimization.toFixed(0)}%`,
        estimatedImpact: 'medium',
        implementation: '1. 使用WebP格式图片\n2. 实现响应式图片\n3. 启用图片懒加载\n4. 使用CDN加速图片加载',
      });
    }

    // API响应时间优化建议
    if (runtimeMetrics.apiResponseTime > PERFORMANCE_THRESHOLDS.apiResponseTime.needsImprovement) {
      recommendations.push({
        category: runtimeMetrics.apiResponseTime > PERFORMANCE_THRESHOLDS.apiResponseTime.needsImprovement * 1.5 ? 'critical' : 'important',
        title: '优化API响应时间',
        description: `平均API响应时间为${Math.round(runtimeMetrics.apiResponseTime)}ms`,
        estimatedImpact: runtimeMetrics.apiResponseTime > 500 ? 'high' : 'medium',
        implementation: '1. 实现API响应缓存\n2. 优化数据库查询\n3. 使用GraphQL减少数据传输\n4. 启用HTTP/2或HTTP/3',
      });
    }

    return recommendations;
  }, []);

  // 计算总体评分
  const calculateOverallScore = useCallback((
    coreWebVitals: PerformanceAnalysisResult['coreWebVitals'],
    resourceMetrics: PerformanceAnalysisResult['resourceMetrics'],
    runtimeMetrics: PerformanceAnalysisResult['runtimeMetrics']
  ): number => {
    // 核心Web指标权重60%
    const fcpScore = getScoreFromGrade(coreWebVitals.fcp.grade);
    const lcpScore = getScoreFromGrade(coreWebVitals.lcp.grade);
    const clsScore = getScoreFromGrade(coreWebVitals.cls.grade);
    const fidScore = getScoreFromGrade(coreWebVitals.fid.grade);
    const webVitalsScore = (fcpScore + lcpScore + clsScore + fidScore) / 4;

    // 资源指标权重20%
    const bundleSizeScore = Math.max(0, 100 - (resourceMetrics.bundleSize / PERFORMANCE_THRESHOLDS.bundleSize.needsImprovement) * 50);
    const resourceScore = bundleSizeScore;

    // 运行时指标权重20%
    const memoryScore = Math.max(0, 100 - (runtimeMetrics.memoryUsage / PERFORMANCE_THRESHOLDS.memoryUsage.needsImprovement) * 50);
    const apiScore = Math.max(0, 100 - (runtimeMetrics.apiResponseTime / PERFORMANCE_THRESHOLDS.apiResponseTime.needsImprovement) * 50);
    const runtimeScore = (memoryScore + apiScore) / 2;

    return Math.round(webVitalsScore * 0.6 + resourceScore * 0.2 + runtimeScore * 0.2);
  }, []);

  // 从等级获取分数
  const getScoreFromGrade = (grade: 'A' | 'B' | 'C' | 'D'): number => {
    switch (grade) {
      case 'A': return 95;
      case 'B': return 80;
      case 'C': return 60;
      case 'D': return 30;
      default: return 0;
    }
  };

  // 获取优化等级
  const getOptimizationLevel = (score: number): PerformanceAnalysisResult['optimizationLevel'] => {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'needs-work';
    return 'poor';
  };

  // 执行性能分析
  const runAnalysis = useCallback(() => {
    setIsAnalyzing(true);
    recordInteraction('performance_analysis_start');

    // 模拟分析过程
    setTimeout(() => {
      const coreWebVitals = getCoreWebVitals();
      const resourceMetrics = getResourceMetrics();
      const runtimeMetrics = getRuntimeMetrics();
      const recommendations = generateRecommendations(coreWebVitals, resourceMetrics, runtimeMetrics);
      const overallScore = calculateOverallScore(coreWebVitals, resourceMetrics, runtimeMetrics);
      const optimizationLevel = getOptimizationLevel(overallScore);

      const result: PerformanceAnalysisResult = {
        coreWebVitals,
        resourceMetrics,
        runtimeMetrics,
        recommendations,
        overallScore,
        optimizationLevel,
      };

      setAnalysisResult(result);
      setIsAnalyzing(false);
      recordInteraction('performance_analysis_complete', 2000);
    }, 1500);
  }, [getCoreWebVitals, getResourceMetrics, getRuntimeMetrics, generateRecommendations, calculateOverallScore, recordInteraction]);

  // 自动分析（页面加载完成后）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (document.readyState === 'complete') {
        runAnalysis();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [runAnalysis]);

  // 定期重新分析
  useEffect(() => {
    const interval = setInterval(runAnalysis, 60000); // 每分钟分析一次
    return () => clearInterval(interval);
  }, [runAnalysis]);

  return {
    analysisResult,
    isAnalyzing,
    runAnalysis,
    // 工具方法
    getCoreWebVitals,
    getResourceMetrics,
    getRuntimeMetrics,
  };
}

// 性能分析结果组件
export function PerformanceAnalysisPanel() {
  const { analysisResult, isAnalyzing, runAnalysis } = useAdvancedAnalytics();

  if (!analysisResult) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">正在分析性能指标...</p>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 75) return 'text-blue-600 bg-blue-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'important': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'moderate': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* 总体评分 */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">性能分析报告</h3>
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isAnalyzing ? '分析中...' : '重新分析'}
          </button>
        </div>

        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${getScoreColor(analysisResult.overallScore)}`}>
            <span className="text-2xl font-bold">{analysisResult.overallScore}</span>
          </div>
          <p className="mt-2 text-sm text-gray-600">总体评分</p>
          <p className={`text-sm font-medium ${
            analysisResult.optimizationLevel === 'excellent' ? 'text-green-600' :
            analysisResult.optimizationLevel === 'good' ? 'text-blue-600' :
            analysisResult.optimizationLevel === 'needs-work' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {analysisResult.optimizationLevel === 'excellent' ? '优秀' :
             analysisResult.optimizationLevel === 'good' ? '良好' :
             analysisResult.optimizationLevel === 'needs-work' ? '需要改进' : '较差'}
          </p>
        </div>
      </div>

      {/* 核心Web指标 */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">核心Web指标</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(analysisResult.coreWebVitals).map(([metric, data]) => (
            <div key={metric} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {metric === 'fcp' ? Math.round(data.value) + 'ms' :
                 metric === 'lcp' ? Math.round(data.value) + 'ms' :
                 metric === 'cls' ? data.value.toFixed(3) :
                 Math.round(data.value) + 'ms'}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {metric === 'fcp' ? '首次内容绘制' :
                 metric === 'lcp' ? '最大内容绘制' :
                 metric === 'cls' ? '累积布局偏移' : '首次输入延迟'}
              </p>
              <div className="flex items-center justify-center mt-2">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  data.grade === 'A' ? 'bg-green-100 text-green-800' :
                  data.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                  data.grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                }`}>
                  等级 {data.grade}
                </span>
                <span className={`ml-2 text-xs ${getStatusColor(data.status)}`}>
                  {data.status === 'good' ? '✓ 良好' :
                   data.status === 'needs-improvement' ? '⚠ 需改进' : '✗ 较差'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 资源指标 */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">资源性能</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">包大小</p>
            <p className="text-lg font-semibold text-gray-900">
              {(analysisResult.resourceMetrics.bundleSize / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">未使用JavaScript</p>
            <p className="text-lg font-semibold text-gray-900">
              {(analysisResult.resourceMetrics.unusedJavaScript / 1024).toFixed(2)} KB
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">图片优化</p>
            <p className="text-lg font-semibold text-gray-900">
              {analysisResult.resourceMetrics.imageOptimization.toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* 优化建议 */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">优化建议</h3>
        <div className="space-y-4">
          {analysisResult.recommendations.map((rec, index) => (
            <div key={index} className={`p-4 border rounded-lg ${getCategoryColor(rec.category)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold">{rec.title}</h4>
                  <p className="text-sm mt-1 opacity-90">{rec.description}</p>
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer underline">实施步骤</summary>
                    <pre className="mt-2 text-xs whitespace-pre-wrap opacity-80">{rec.implementation}</pre>
                  </details>
                </div>
                <div className="ml-4 text-right">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                    rec.estimatedImpact === 'high' ? 'bg-red-100 text-red-800' :
                    rec.estimatedImpact === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {rec.estimatedImpact === 'high' ? '高影响' :
                     rec.estimatedImpact === 'medium' ? '中影响' : '低影响'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}