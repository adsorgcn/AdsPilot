'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import TextField from '~/core/ui/TextField';
import Button from '~/core/ui/Button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import classNames from 'clsx';
import configuration from '~/configuration';

type Command = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  action: () => void;
};

const SAVE_EVENT = 'app:save-form';

export default function GlobalHotkeys() {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [query, setQuery] = useState('');

  const commands = useMemo<Command[]>(() => {
    const appHome = configuration.paths.appHome;

    return [
      {
        id: 'dashboard',
        label: '前往控制台',
        description: '查看概览与快捷入口',
        shortcut: '⌘1',
        action: () => router.push(appHome),
      },
      {
        id: 'offers',
        label: '新建 Offer',
        description: '打开批量导入和落地页评估入口',
        shortcut: '⌘2',
        action: () => router.push(`${appHome}/offers/new`),
      },
      {
        id: 'tasks',
        label: '查看任务中心',
        description: '跟踪协作任务与状态流转',
        shortcut: '⌘3',
        action: () => router.push(`${appHome}/tasks`),
      },
      {
        id: 'contact',
        label: '联系我们',
        description: '预约演示或获取支持',
        shortcut: '⌘4',
        action: () => router.push('/contact'),
      },
      {
        id: 'toggle-help',
        label: showHelp ? '关闭快捷键说明' : '查看快捷键说明',
        description: 'Shift + ?',
        action: () => setShowHelp((value) => !value),
      },
    ];
  }, [router, showHelp]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }

    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(lowerQuery) ||
        command.description.toLowerCase().includes(lowerQuery),
    );
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;

      if (isModifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((value) => !value);
        setShowHelp(false);
        setQuery('');
        return;
      }

      if (isModifier && event.key.toLowerCase() === 's') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(SAVE_EVENT));
        return;
      }

      if (event.shiftKey && event.key === '?') {
        event.preventDefault();
        setIsOpen(true);
        setShowHelp(true);
        setQuery('');
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setShowHelp(false);
      setQuery('');
    }
  }, [isOpen]);

  const shortcuts = useMemo(
    () => [
      { keys: '⌘ + K / Ctrl + K', description: '打开命令面板' },
      { keys: '⌘ + S / Ctrl + S', description: '保存当前表单' },
      { keys: 'Shift + ?', description: '查看快捷键' },
      { keys: '⌘ + 1/2/3/4', description: '快速跳转到主要模块' },
    ],
    [],
  );

  return (
    <>
      <CommandPalette
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        query={query}
        onQueryChange={setQuery}
        commands={filteredCommands}
        showHelp={showHelp}
        shortcuts={shortcuts}
      />
    </>
  );
}

function CommandPalette({
  isOpen,
  onOpenChange,
  query,
  onQueryChange,
  commands,
  showHelp,
  shortcuts,
}: {
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
  query: string;
  onQueryChange: (value: string) => void;
  commands: Command[];
  showHelp: boolean;
  shortcuts: Array<{ keys: string; description: string }>;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle className="text-base font-semibold text-gray-900">
            {showHelp ? '快捷键说明' : '命令面板'}
          </DialogTitle>

          <Button
            variant="ghost"
            size="small"
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="sr-only">关闭</span>
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {showHelp ? (
          <ShortcutHelp shortcuts={shortcuts} />
        ) : (
          <CommandList
            query={query}
            onQueryChange={onQueryChange}
            commands={commands}
            onSelect={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CommandList({
  query,
  onQueryChange,
  commands,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  commands: Command[];
  onSelect: () => void;
}) {
  return (
    <div className="space-y-4">
      <TextField>
        <TextField.Input
          autoFocus
          placeholder="搜索命令或输入关键词..."
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
        />
      </TextField>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
        {commands.length === 0 && (
          <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
            未找到匹配的命令
          </p>
        )}

        {commands.map((command) => {
          return (
            <button
              key={command.id}
              type="button"
              onClick={() => {
                command.action();
                onSelect();
              }}
              className={classNames(
                'flex w-full items-start justify-between gap-3 rounded-md border border-transparent px-4 py-3 text-left transition',
                'hover:border-primary/40 hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none',
              )}
            >
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {command.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {command.description}
                </span>
              </span>

              {command.shortcut ? (
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                  {command.shortcut}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShortcutHelp({
  shortcuts,
}: {
  shortcuts: Array<{ keys: string; description: string }>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        使用以下快捷键可大幅提升效率。
      </p>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {shortcuts.map((shortcut) => (
          <li
            key={shortcut.keys}
            className="flex items-start justify-between rounded-md border border-muted px-4 py-3"
          >
            <span className="text-sm text-muted-foreground">
              {shortcut.description}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              {shortcut.keys}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
