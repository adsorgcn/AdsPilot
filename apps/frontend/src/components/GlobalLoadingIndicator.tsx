'use client';

import TopLoadingBarIndicator from '~/components/TopLoadingBarIndicator';
import Trans from '~/core/ui/Trans';
import LoadingOverlay from '~/core/ui/LoadingOverlay';
import FadeIn from '~/components/FadeIn';
import { useLoadingStore } from '~/lib/stores/useLoadingStore';

/**
 * 全局加载指示器组件
 *
 * 支持两种使用方式:
 * 1. 手动控制: 通过 children 传入自定义加载文本
 * 2. 全局状态: 自动显示 useLoadingStore 中的加载消息
 *
 * @param children - 自定义加载文本（可选）
 * @param displayLogo - 是否显示 Logo
 * @param fullPage - 是否全屏显示
 * @param useGlobalState - 是否使用全局加载状态（默认 false，保持向后兼容）
 */
function GlobalLoadingIndicator({
  children,
  displayLogo = false,
  fullPage = false,
  useGlobalState = false,
}: React.PropsWithChildren<{
  displayLogo?: boolean;
  fullPage?: boolean;
  useGlobalState?: boolean;
}>) {
  const { isLoading, message } = useLoadingStore();

  // 如果启用全局状态且没有加载中，则不显示
  if (useGlobalState && !isLoading) {
    return <TopLoadingBarIndicator autoStart={false} />;
  }

  // 优先使用全局状态消息，否则使用 children，最后回退到默认文本
  const Text = useGlobalState && message ? message : (children ?? <Trans i18nKey={'common:loading'} />);

  return (
    <>
      <TopLoadingBarIndicator autoStart={!useGlobalState} />

      <FadeIn>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-24 text-center">
          <LoadingOverlay displayLogo={displayLogo} fullPage={fullPage}>
            {Text}
          </LoadingOverlay>
        </div>
      </FadeIn>
    </>
  );
}

export default GlobalLoadingIndicator;
