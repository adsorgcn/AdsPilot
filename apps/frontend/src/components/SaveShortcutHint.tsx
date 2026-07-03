'use client';

import classNames from 'clsx';
import { Badge } from '~/components/ui/badge';
import useSaveShortcutHint from '~/core/hooks/use-save-shortcut';

type Props = {
  className?: string;
  message?: string | ((shortcut: string) => React.ReactNode);
};

export default function SaveShortcutHint({ className, message }: Props) {
  const hotkey = useSaveShortcutHint();
  const content =
    typeof message === 'function' ? message(hotkey) : message ?? `使用 ${hotkey} 快速保存`;

  return (
    <p
      className={classNames(
        'mt-2 flex items-center gap-2 text-xs text-muted-foreground',
        className,
      )}
    >
      <Badge size="small" color="info">
        {hotkey}
      </Badge>
      <span>{content}</span>
    </p>
  );
}
