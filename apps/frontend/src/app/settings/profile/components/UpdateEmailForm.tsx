'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User } from '@supabase/supabase-js';

import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import If from '~/core/ui/If';
import Alert from '~/core/ui/Alert';
import Trans from '~/core/ui/Trans';

import useUpdateUserMutation from '~/core/hooks/use-update-user-mutation';
import useFormHotkeys from '~/core/hooks/use-form-hotkeys';
import SaveShortcutHint from '~/components/SaveShortcutHint';
import { announce } from '~/core/utils/announce';

import configuration from '~/configuration';

const UpdateEmailForm: React.FC<{ user: User }> = ({ user }) => {
  const { t } = useTranslation();
  const updateUserMutation = useUpdateUserMutation();

  const updateEmail = useCallback(
    (email: string) => {
      const redirectTo = [
        window.location.origin,
        configuration.paths.authCallback,
      ].join('');

      // then, we update the user's email address
      const promise = updateUserMutation
        .mutateAsync({ email, redirectTo })
        .then(() => {
          announce(t(`profile:updateEmailSuccess`));
        })
        .catch((error: Error) => {
          announce(error.message ?? t(`profile:updateEmailError`), 'assertive');
          throw error;
        });

      toast.promise(promise, {
        success: t(`profile:updateEmailSuccess`),
        loading: t(`profile:updateEmailLoading`),
        error: (error: Error) => {
          return error.message ?? t(`profile:updateEmailError`);
        },
      });

      return promise;
    },
    [t, updateUserMutation],
  );

  const currentEmail = user?.email as string;

  const schema = useMemo(
    () =>
      z
        .object({
          email: z.string().trim().email(t('profile:invalidEmail')),
          repeatEmail: z.string().trim().email(t('profile:invalidEmail')),
        })
        .superRefine((value, ctx) => {
          if (value.email !== value.repeatEmail) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['repeatEmail'],
              message: t('profile:emailsNotMatching'),
            });
          }

          if (value.email === currentEmail) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['email'],
              message: t('profile:updatingSameEmail'),
            });
          }
        }),
    [t, currentEmail],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      repeatEmail: '',
    },
  });

  const onSubmit = useCallback(
    async ({ email }: z.infer<typeof schema>) => {
      return updateEmail(email);
    },
    [updateEmail],
  );

  const emailControl = register('email');
  const repeatEmailControl = register('repeatEmail');

  useFormHotkeys(() => {
    handleSubmit(onSubmit)();
  });

  // reset the form on success
  useEffect(() => {
    if (updateUserMutation.data) {
      reset();
    }
  }, [reset, updateUserMutation.data]);

  return (
    <form
      className={'flex flex-col space-y-4'}
      data-cy={'update-email-form'}
        onSubmit={handleSubmit(onSubmit)}
    >
      <If condition={updateUserMutation.data}>
        <Alert type={'success'}>
          <Alert.Heading>
            <Trans i18nKey={'profile:updateEmailSuccess'} />
          </Alert.Heading>

          <Trans i18nKey={'profile:updateEmailSuccessMessage'} />
        </Alert>
      </If>

      <div className={'flex flex-col space-y-4'}>
        <TextField>
          <TextField.Label>
            <Trans i18nKey={'profile:newEmail'} />

            <TextField.Input
              {...emailControl}
              data-cy={'profile-new-email-input'}
              type={'email'}
              placeholder={''}
            />
            <TextField.Error error={errors.email?.message} />
          </TextField.Label>
        </TextField>

        <TextField>
          <TextField.Label>
            <Trans i18nKey={'profile:repeatEmail'} />

            <TextField.Input
              {...repeatEmailControl}
              data-cy={'profile-repeat-email-input'}
              type={'email'}
            />
            <TextField.Error error={errors.repeatEmail?.message} />
          </TextField.Label>
        </TextField>

        <div>
          <Button
            className={'w-full md:w-auto'}
            loading={updateUserMutation.isPending}
          >
            <Trans i18nKey={'profile:updateEmailSubmitLabel'} />
          </Button>

          <SaveShortcutHint message={(shortcut) => t('profile:saveShortcut.updateEmail', { shortcut })} />
        </div>
      </div>
    </form>
  );
};

export default UpdateEmailForm;
