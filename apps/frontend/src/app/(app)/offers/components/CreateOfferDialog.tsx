"use client";

import { useCallback, useState, useTransition, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/core/ui/Dialog';

import { useCreateOffer } from '~/lib/offers';
import useFormHotkeys from '~/core/hooks/use-form-hotkeys';
import SaveShortcutHint from '~/components/SaveShortcutHint';
import { announce } from '~/core/utils/announce';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

function CreateOfferDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation('common');
  const createOffer = useCreateOffer();
  const [url, setUrl] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = useCallback(() => {
    setError(undefined);

    if (!url.trim()) {
      setError(t('offers.create.urlRequired'));
      return;
    }

    startTransition(async () => {
      try {
        await createOffer({
          url: url.trim(),
          country: country.trim() || undefined,
        });

        toast.success(t('offers.create.success'));
        announce(t('offers.create.successAnnounce'));
        setUrl('');
        setCountry('');
        onOpenChange(false);
        onCreated?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : t('offers.create.failed');
        toast.error(message);
        announce(message, 'assertive');
      }
    });
  }, [country, createOffer, onCreated, onOpenChange, url, t]);

  useFormHotkeys(handleSubmit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={'sm:max-w-lg'}>
        <DialogHeader>
          <DialogTitle>{t('offers.create.title')}</DialogTitle>
          <DialogDescription>
            {t('offers.create.description')}
          </DialogDescription>
        </DialogHeader>

        <div className={'flex flex-col space-y-4 py-2'}>
          <TextField>
            <TextField.Label htmlFor={'offer-url'}>{t('offers.create.urlLabel')}</TextField.Label>
            <TextField.Input
              id={'offer-url'}
              value={url}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setUrl(event.target.value)
              }
              placeholder={'https://example.com'}
              type={'url'}
              required
            />
            <TextField.Hint>{t('offers.create.urlHint')}</TextField.Hint>
            <TextField.Error error={error} />
          </TextField>

          <TextField>
            <TextField.Label htmlFor={'offer-country'}>{t('offers.create.countryLabel')}</TextField.Label>
            <TextField.Input
              id={'offer-country'}
              value={country}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCountry(event.target.value)
              }
              placeholder={t('offers.create.countryPlaceholder')}
            />
            <TextField.Hint>{t('offers.create.countryHint')}</TextField.Hint>
          </TextField>
        </div>

        <DialogFooter className={'flex justify-end space-x-3'}>
          <Button
            variant={'ghost'}
            type={'button'}
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('cancel')}
          </Button>

          <Button type={'button'} loading={isPending} onClick={handleSubmit}>
            {t('offers.create.submit')}
          </Button>
        </DialogFooter>

        <SaveShortcutHint message={(shortcut) => t('offers.create.shortcutHint', { shortcut })} />
      </DialogContent>
    </Dialog>
  );
}

export default CreateOfferDialog;
