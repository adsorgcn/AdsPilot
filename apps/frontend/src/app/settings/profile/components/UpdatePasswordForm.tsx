'use client';

import { useCallback, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';

import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import useUpdateUserMutation from '~/core/hooks/use-update-user-mutation';
import useFormHotkeys from '~/core/hooks/use-form-hotkeys';
import SaveShortcutHint from '~/components/SaveShortcutHint';
import { announce } from '~/core/utils/announce';

import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import Alert from '~/core/ui/Alert';
import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';

import configuration from '~/configuration';

const UpdatePasswordForm = ({ user }: { user: User }) => {
  const { t } = useTranslation();
  const updateUserMutation = useUpdateUserMutation();
  const [needsReauthentication, setNeedsReauthentication] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          newPassword: z
            .string()
            .min(6, t('auth:passwordLengthError')),
          repeatPassword: z
            .string()
            .min(6, t('profile:passwordLengthError')),
        })
        .refine((value) => value.newPassword === value.repeatPassword, {
          message: t('profile:passwordNotMatching'),
          path: ['repeatPassword'],
        }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      newPassword: '',
      repeatPassword: '',
    },
  });

  const newPasswordControl = register('newPassword');
  const repeatPasswordControl = register('repeatPassword');

  const updatePasswordFromCredential = useCallback(
    (password: string) => {
      const redirectTo = [
        window.location.origin,
        configuration.paths.authCallback,
      ].join('');

      const promise = updateUserMutation
        .mutateAsync({ password, redirectTo })
        .then(() => {
          reset();
          setNeedsReauthentication(false);
          announce(t(`profile:updatePasswordSuccess`));
        })
        .catch((error: string) => {
          if (typeof error === 'string' && error.includes('Password update requires reauthentication')) {
            setNeedsReauthentication(true);
          }

          announce(t(`profile:updatePasswordError`), 'assertive');
          throw error;
        });

      toast.promise(promise, {
        success: t(`profile:updatePasswordSuccess`),
        error: t(`profile:updatePasswordError`),
        loading: t(`profile:updatePasswordLoading`),
      });

      return promise;
    },
    [updateUserMutation, t, reset],
  );

  const updatePasswordCallback = useCallback(
    async ({ newPassword }: z.infer<typeof schema>) => {
      const email = user.email;

      // if the user does not have an email assigned, it's possible they
      // don't have an email/password factor linked, and the UI is out of sync
      if (!email) {
        return Promise.reject(t(`profile:cannotUpdatePassword`));
      }

      updatePasswordFromCredential(newPassword);
    },
    [user.email, updatePasswordFromCredential, t],
  );

  const { isPending, data } = updateUserMutation;

  useFormHotkeys(() => {
    handleSubmit(updatePasswordCallback)();
  });

  return (
    <form
      data-cy={'update-password-form'}
      onSubmit={handleSubmit(updatePasswordCallback)}
    >
      <div className={'flex flex-col space-y-4'}>
        <If condition={data}>
          <Alert type={'success'}>
            <Alert.Heading>
              <Trans i18nKey={'profile:updatePasswordSuccess'} />
            </Alert.Heading>

            <Trans i18nKey={'profile:updatePasswordSuccessMessage'} />
          </Alert>
        </If>

        <If condition={needsReauthentication}>
          <Alert type={'warn'}>
            <Alert.Heading>
              <Trans i18nKey={'profile:needsReauthentication'} />
            </Alert.Heading>

            <Trans i18nKey={'profile:needsReauthenticationDescription'} />
          </Alert>
        </If>

        <TextField>
          <TextField.Label>
            <Trans i18nKey={'profile:newPassword'} />

            <TextField.Input
              data-cy={'new-password'}
              type={'password'}
              {...newPasswordControl}
            />

            <TextField.Error
              data-cy={'new-password-error'}
              error={errors.newPassword?.message}
            />
          </TextField.Label>
        </TextField>

        <TextField>
          <TextField.Label>
            <Trans i18nKey={'profile:repeatPassword'} />

            <TextField.Input
              data-cy={'repeat-new-password'}
              type={'password'}
              {...repeatPasswordControl}
            />

            <TextField.Error
              data-cy={'repeat-password-error'}
              error={errors.repeatPassword?.message}
            />
          </TextField.Label>
        </TextField>

        <div>
          <Button className={'w-full md:w-auto'} loading={isPending}>
            <Trans i18nKey={'profile:updatePasswordSubmitLabel'} />
          </Button>

          <SaveShortcutHint message={(shortcut) => t('profile:saveShortcut.updatePassword', { shortcut })} />
        </div>
      </div>
    </form>
  );
};

export default UpdatePasswordForm;
