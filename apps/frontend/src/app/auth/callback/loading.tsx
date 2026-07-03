import FadeIn from '~/components/FadeIn';
import Spinner from '~/core/ui/Spinner';

export default function CallbackLoading() {
  return (
    <FadeIn>
      <div className="flex flex-col items-center space-y-4 text-center">
        <Spinner />
        <h2 className="text-lg font-semibold">正在登录...</h2>
        <p className="text-sm text-muted-foreground">正在设置您的账户</p>
      </div>
    </FadeIn>
  );
}
