'use client';

import { createRef, useEffect, useRef } from 'react';
import LoadingBar, { LoadingBarRef } from 'react-top-loading-bar';
import { useLoadingStore } from '~/lib/stores/useLoadingStore';

/**
 * 全局顶部加载条指示器
 *
 * 支持两种模式:
 * 1. 自动模式: 组件挂载时自动显示进度条（原有行为）
 * 2. 全局状态模式: 响应 useLoadingStore 的状态变化
 *
 * @param autoStart - 是否在组件挂载时自动开始加载动画（默认 true，保持向后兼容）
 */
function TopLoadingBarIndicator({ autoStart = true }: { autoStart?: boolean }) {
  const ref = createRef<LoadingBarRef>();
  const runningRef = useRef(false);
  const isLoading = useLoadingStore((state) => state.isLoading);

  // 原有的自动加载行为（向后兼容）
  useEffect(() => {
    if (!autoStart || !ref.current || runningRef.current) {
      return;
    }

    const loadingBarRef = ref.current;

    loadingBarRef.continuousStart(0, 250);
    runningRef.current = true;

    return () => {
      loadingBarRef.complete();
      runningRef.current = false;
    };
  }, [ref, autoStart]);

  // 响应全局加载状态
  useEffect(() => {
    if (autoStart) {
      return; // 如果是自动模式，不响应全局状态
    }

    if (!ref.current) {
      return;
    }

    const loadingBarRef = ref.current;

    if (isLoading) {
      loadingBarRef.continuousStart(0, 250);
    } else {
      loadingBarRef.complete();
    }
  }, [isLoading, ref, autoStart]);

  return (
    <LoadingBar
      height={4}
      waitingTime={0}
      shadow
      className={'bg-primary'}
      color={''}
      ref={ref}
    />
  );
}

export default TopLoadingBarIndicator;
