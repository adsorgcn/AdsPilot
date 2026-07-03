'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import Button from '~/core/ui/Button';
import { cn } from '~/core/generic/shadcn-utils';

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  category?: string;
}

export interface KeyboardShortcutsProps {
  /**
   * List of keyboard shortcuts
   */
  shortcuts: KeyboardShortcut[];
  /**
   * Whether to show the help modal
   */
  showHelp?: boolean;
  /**
   * Callback when help modal closes
   */
  onHelpClose?: () => void;
}

/**
 * useKeyboardShortcuts - Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const [showHelp, setShowHelp] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for help shortcut (Cmd/Ctrl + /)
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        setShowHelp(true);
        return;
      }

      // Check for registered shortcuts
      for (const shortcut of shortcuts) {
        const keys = shortcut.key.toLowerCase().split('+');
        const mainKey = keys[keys.length - 1];

        const modifierMatch =
          (!keys.includes('cmd') && !keys.includes('ctrl')) ||
          ((keys.includes('cmd') || keys.includes('ctrl')) && (event.metaKey || event.ctrlKey));

        const altMatch = !keys.includes('alt') || event.altKey;
        const shiftMatch = !keys.includes('shift') || event.shiftKey;
        const keyMatch = event.key.toLowerCase() === mainKey;

        if (modifierMatch && altMatch && shiftMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  return { showHelp, setShowHelp };
}

/**
 * KeyboardShortcutsHelp - Modal showing all available shortcuts
 */
export function KeyboardShortcutsHelp({
  shortcuts,
  open,
  onClose,
}: {
  shortcuts: KeyboardShortcut[];
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('common');

  // Group shortcuts by category
  const groupedShortcuts = React.useMemo(() => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    shortcuts.forEach(shortcut => {
      const category = shortcut.category || 'General';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(shortcut);
    });
    return groups;
  }, [shortcuts]);

  const formatKey = (key: string) => {
    return key
      .split('+')
      .map(k => {
        const keyMap: Record<string, string> = {
          cmd: '⌘',
          ctrl: 'Ctrl',
          alt: '⌥',
          shift: '⇧',
        };
        return keyMap[k.toLowerCase()] || k.toUpperCase();
      })
      .join(' + ');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <GlassCard variant="gradient" className="max-h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                    <Command className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {t('shortcuts.title', 'Keyboard Shortcuts')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t('shortcuts.subtitle', 'Speed up your workflow')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(80vh - 100px)' }}>
                {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {categoryShortcuts.map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg bg-muted/50 p-3 hover:bg-muted transition-colors"
                        >
                          <span className="text-sm">{shortcut.description}</span>
                          <kbd className="inline-flex items-center gap-1 rounded bg-white dark:bg-gray-800 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm border border-border">
                            {formatKey(shortcut.key)}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-border/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  {t('shortcuts.footer', 'Press')} <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">⌘ /</kbd> {t('shortcuts.footer2', 'to toggle this menu')}
                </p>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * KeyboardShortcutBadge - Display a keyboard shortcut badge
 */
export function KeyboardShortcutBadge({
  shortcut,
  className,
}: {
  shortcut: string;
  className?: string;
}) {
  const formatKey = (key: string) => {
    return key
      .split('+')
      .map(k => {
        const keyMap: Record<string, string> = {
          cmd: '⌘',
          ctrl: 'Ctrl',
          alt: '⌥',
          shift: '⇧',
        };
        return keyMap[k.toLowerCase()] || k.toUpperCase();
      })
      .join(' ');
  };

  return (
    <kbd
      className={cn(
        'inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground',
        className
      )}
    >
      {formatKey(shortcut)}
    </kbd>
  );
}