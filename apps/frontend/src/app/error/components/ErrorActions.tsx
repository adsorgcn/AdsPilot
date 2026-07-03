'use client';

import Button from '~/core/ui/Button';

export default function ErrorActions() {
  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        onClick={() => window.location.reload()}
      >
        重试
      </Button>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          // 清除可能损坏的session并重新登录
          window.location.href = '/auth';
        }}
      >
        重新登录
      </Button>

      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          // 联系支持
          window.location.href = 'mailto:support@autoads.dev';
        }}
      >
        联系支持
      </Button>
    </div>
  );
}