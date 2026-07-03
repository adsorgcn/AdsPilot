import type { Metadata } from 'next';
// import { redirect } from 'next/navigation';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import Button from '~/core/ui/Button';
import FadeIn from '~/components/FadeIn';

export const metadata: Metadata = {
  title: 'Error - Google-Monetize',
};

interface ErrorPageProps {
  searchParams: {
    code?: string;
    message?: string;
  };
}

/**
 * 通用错误页面
 */
export default async function ErrorPage({ searchParams }: ErrorPageProps) {
  const client = await getSupabaseServerComponentClient();
  const { data: { user } } = await client.auth.getUser();
  
  const errorCode = searchParams.code || 'UNKNOWN_ERROR';
  const errorMessage = searchParams.message;

  // 错误信息映射
  const errorInfo: Record<string, { title: string; description: string; actions: string[] }> = {
    APP_DATA_LOAD_FAILED: {
      title: 'Failed to Load Application Data',
      description: 'We encountered an error while loading your application data. This might be a temporary issue.',
      actions: ['retry', 'dashboard', 'signout'],
    },
    REDIRECT_LOOP: {
      title: 'Redirect Loop Detected',
      description: 'We detected a redirect loop. This usually indicates a configuration issue.',
      actions: ['clear', 'dashboard', 'support'],
    },
    UNKNOWN_ERROR: {
      title: 'An Error Occurred',
      description: errorMessage || 'An unexpected error occurred. Please try again.',
      actions: ['retry', 'home', 'support'],
    },
  };

  const info = errorInfo[errorCode] || errorInfo.UNKNOWN_ERROR;

  return (
    <div className="flex min-h-[50vh] items-center justify-center py-24">
      <FadeIn>
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 border border-border">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-destructive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {info.title}
            </h1>
            <p className="text-muted-foreground">
              {info.description}
            </p>
          </div>

          {user && (
            <div className="rounded-lg bg-muted p-4 mb-6">
              <p className="text-sm">
                <strong>Account:</strong>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {user.email}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Error Code: {errorCode}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {info.actions.includes('retry') && (
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Retry
              </Button>
            )}

            {info.actions.includes('dashboard') && (
              <Button
                variant="outline"
                onClick={() => window.location.href = '/dashboard'}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            )}

            {info.actions.includes('home') && (
              <Button
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="w-full"
              >
                Go to Home
              </Button>
            )}

            {info.actions.includes('clear') && (
              <Button
                variant="outline"
                onClick={() => {
                  // 清除所有cookies
                  document.cookie.split(";").forEach((c) => {
                    document.cookie = c
                      .replace(/^ +/, "")
                      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                  });
                  window.location.href = '/';
                }}
                className="w-full"
              >
                Clear Cookies & Retry
              </Button>
            )}

            {info.actions.includes('signout') && user && (
              <Button
                variant="outline"
                onClick={async () => {
                  await client.auth.signOut();
                  window.location.href = '/auth';
                }}
                className="w-full"
              >
                Sign Out
              </Button>
            )}
          </div>

          {info.actions.includes('support') && (
            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                Need help?{' '}
                <a
                  href="mailto:support@autoads.dev"
                  className="text-primary hover:underline"
                >
                  support@autoads.dev
                </a>
              </p>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
