'use client';

import { useEffect, useCallback } from 'react';

type KeyboardHandler = (event: KeyboardEvent) => void;

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Command on Mac
  handler: () => void;
}

/**
 * useKeyboard hook
 * Listens to keyboard events and executes handlers
 *
 * @param shortcuts - Array of keyboard shortcuts to listen for
 *
 * @example
 * useKeyboard([
 *   { key: 'k', meta: true, handler: () => openSearch() },
 *   { key: 'Escape', handler: () => closeModal() },
 * ]);
 */
export function useKeyboard(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback<KeyboardHandler>(
    (event) => {
      for (const shortcut of shortcuts) {
        const {
          key,
          ctrl = false,
          shift = false,
          alt = false,
          meta = false,
          handler,
        } = shortcut;

        const ctrlMatch = ctrl ? event.ctrlKey : !event.ctrlKey;
        const shiftMatch = shift ? event.shiftKey : !event.shiftKey;
        const altMatch = alt ? event.altKey : !event.altKey;
        const metaMatch = meta ? event.metaKey : !event.metaKey;

        if (
          event.key.toLowerCase() === key.toLowerCase() &&
          (ctrl || !event.ctrlKey) &&
          (shift || !event.shiftKey) &&
          (alt || !event.altKey) &&
          (meta || !event.metaKey) &&
          ctrlMatch &&
          shiftMatch &&
          altMatch &&
          metaMatch
        ) {
          event.preventDefault();
          handler();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * useEscape hook
 * Simplified hook for handling Escape key
 *
 * @param handler - Function to call when Escape is pressed
 *
 * @example
 * useEscape(() => setIsOpen(false));
 */
export function useEscape(handler: () => void) {
  useKeyboard([{ key: 'Escape', handler }]);
}

/**
 * useEnter hook
 * Simplified hook for handling Enter key
 *
 * @param handler - Function to call when Enter is pressed
 *
 * @example
 * useEnter(() => submitForm());
 */
export function useEnter(handler: () => void) {
  useKeyboard([{ key: 'Enter', handler }]);
}
