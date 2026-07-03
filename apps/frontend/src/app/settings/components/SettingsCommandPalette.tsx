"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CommandLineIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline';
import classNames from 'clsx';
import { useTranslation } from 'react-i18next';

import Button from '~/core/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import TextField from '~/core/ui/TextField';

type CommandItem = {
  titleKey: string;
  descriptionKey: string;
  keywordsKey?: string;
  href: string;
};

type TranslatedCommandItem = {
  href: string;
  title: string;
  description: string;
  keywords: string[];
};

const COMMAND_ITEMS: CommandItem[] = [
  {
    titleKey: 'commandPalette.items.profile.title',
    descriptionKey: 'commandPalette.items.profile.description',
    keywordsKey: 'commandPalette.items.profile.keywords',
    href: '/settings/profile',
  },
  {
    titleKey: 'commandPalette.items.authentication.title',
    descriptionKey: 'commandPalette.items.authentication.description',
    keywordsKey: 'commandPalette.items.authentication.keywords',
    href: '/settings/profile/authentication',
  },
  {
    titleKey: 'commandPalette.items.email.title',
    descriptionKey: 'commandPalette.items.email.description',
    keywordsKey: 'commandPalette.items.email.keywords',
    href: '/settings/profile/email',
  },
  {
    titleKey: 'commandPalette.items.password.title',
    descriptionKey: 'commandPalette.items.password.description',
    keywordsKey: 'commandPalette.items.password.keywords',
    href: '/settings/profile/password',
  },
  {
    titleKey: 'commandPalette.items.tokens.title',
    descriptionKey: 'commandPalette.items.tokens.description',
    keywordsKey: 'commandPalette.items.tokens.keywords',
    href: '/settings/tokens',
  },
  {
    titleKey: 'commandPalette.items.subscription.title',
    descriptionKey: 'commandPalette.items.subscription.description',
    keywordsKey: 'commandPalette.items.subscription.keywords',
    href: '/settings/subscription',
  },
  {
    titleKey: 'commandPalette.items.dashboard.title',
    descriptionKey: 'commandPalette.items.dashboard.description',
    keywordsKey: 'commandPalette.items.dashboard.keywords',
    href: '/dashboard',
  },
];

export default function SettingsCommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation('settings');

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const commandItems = useMemo<TranslatedCommandItem[]>(() => {
    return COMMAND_ITEMS.map((item) => ({
      href: item.href,
      title: t(item.titleKey),
      description: t(item.descriptionKey),
      keywords: (() => {
        if (!item.keywordsKey) {
          return [];
        }

        const result = t(item.keywordsKey, {
          returnObjects: true,
        }) as string | string[] | undefined;

        if (!result) {
          return [];
        }

        if (Array.isArray(result)) {
          return result.map((keyword) => String(keyword));
        }

        if (typeof result === 'string' && result.length > 0) {
          return [result];
        }

        return [];
      })(),
    }));
  }, [t]);

  const filteredItems = useMemo(() => {
    if (!commandItems.length) {
      return [];
    }

    if (!query.trim()) {
      return commandItems;
    }

    const keywords = query.trim().toLowerCase();

    return commandItems.filter((item) => {
      if (item.title.toLowerCase().includes(keywords)) {
        return true;
      }

      if (item.description.toLowerCase().includes(keywords)) {
        return true;
      }

      if (item.keywords) {
        return item.keywords.some((keyword) => keyword.toLowerCase().includes(keywords));
      }

      return false;
    });
  }, [commandItems, query]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const hotkeyPressed = isMac ? event.metaKey && event.key === 'k' : event.ctrlKey && event.key === 'k';

      if (hotkeyPressed) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      if (href !== pathname) {
        router.push(href);
      }
    },
    [router, pathname],
  );

  return (
    <Fragment>
      <Button
        type={'button'}
        variant={'outline'}
        size={'sm'}
        onClick={() => setOpen(true)}
        className={'fixed bottom-6 right-6 z-40 flex items-center gap-2 shadow-lg dark:shadow-primary/20'}
      >
        <CommandLineIcon className={'h-4 w-4'} />
        <span className={'hidden sm:inline'}>{t('commandPalette.buttonLabel')}</span>
        <span className={'rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground'}>⌘K</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={'max-w-xl'}>
          <DialogHeader className={'gap-2'}>
            <DialogTitle>{t('commandPalette.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('commandPalette.dialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className={'space-y-4'}>
            <TextField>
              <TextField.Input
                autoFocus
                placeholder={t('commandPalette.inputPlaceholder')}
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.currentTarget.value)}
              />
            </TextField>

            <div className={'max-h-[320px] overflow-y-auto rounded-lg border border-border/60 bg-muted/20'}>
              {filteredItems.length ? (
                <ul className={'divide-y divide-border/60'}>
                  {filteredItems.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                      <li key={item.href}>
                        <button
                          onClick={() => handleSelect(item.href)}
                        className={classNames(
                          'flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-primary/10 focus:bg-primary/10 focus:outline-none',
                          isActive && 'bg-primary/10',
                        )}
                        >
                          <div>
                            <p className={'text-sm font-semibold text-foreground'}>{item.title}</p>
                            <p className={'text-xs text-muted-foreground'}>{item.description}</p>
                          </div>

                          <ArrowUpRightIcon className={'mt-1 h-4 w-4 text-muted-foreground'} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className={'px-4 py-6 text-center text-xs text-muted-foreground'}>
                  {t('commandPalette.empty')}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}
