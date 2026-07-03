import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import Button from '~/core/ui/Button';
import Alert from '~/core/ui/Alert';
import TextField from '~/core/ui/TextField';
import Modal from '~/core/ui/Modal';
import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';

import VerificationCodeInput from '~/app/auth/components/VerificationCodeInput';

import { useVerifyCodeMutation } from './useMfaSetup';
import { FactorQrCode } from './FactorQrCode';

interface MultiFactorAuthSetupFormProps {
  onCancel: () => void;
  onEnrolled: () => void;
}

export function MultiFactorAuthSetupForm({
  onEnrolled,
  onCancel,
}: MultiFactorAuthSetupFormProps) {
  const { t } = useTranslation();
  const { mutateAsync: verifyCode } = useVerifyCodeMutation();
  const [factorId, setFactorId] = useState<string | undefined>();

  const [state, setState] = useState({
    loading: false,
    error: '',
  });

  const invalidVerificationMessage = t('profile:invalidVerificationCode');
  const factorMissingMessage = t('profile:multiFactorSetupError');

  const schema = useMemo(
    () =>
      z.object({
        code: z.string().regex(/^[0-9]{6}$/, invalidVerificationMessage),
      }),
    [invalidVerificationMessage],
  );

  const {
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
  });

  const code = watch('code');

  const onSubmit = useCallback(
    async ({ code }: z.infer<typeof schema>) => {
      setState({
        loading: true,
        error: '',
      });

      if (!factorId) {
        setState({
          loading: false,
          error: factorMissingMessage,
        });
        return;
      }

      try {
        await verifyCode({ factorId, code });

        setState({
          loading: false,
          error: '',
        });

        reset({ code: '' });
        onEnrolled();
      } catch (error) {
        const message = (error as Error).message || `Unknown error`;

        setState({
          loading: false,
          error: message,
        });
      }
    },
    [factorId, factorMissingMessage, onEnrolled, reset, verifyCode],
  );

  if (state.error) {
    return (
      <div className={'flex flex-col space-y-4'}>
        <Alert type={'error'}>
          <Trans i18nKey={'profile:multiFactorSetupError'} />
        </Alert>

        <Modal.CancelButton onClick={onCancel} />
      </div>
    );
  }

  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex justify-center'}>
        <FactorQrCode onCancel={onCancel} onSetFactorId={setFactorId} />
      </div>

      <If condition={factorId}>
        <form onSubmit={handleSubmit(onSubmit)} className={'w-full'}>
          <div className={'flex flex-col space-y-4'}>
            <TextField.Label>
              <Trans i18nKey={'profile:verificationCode'} />

              <VerificationCodeInput
                onInvalid={() =>
                  setValue('code', '', { shouldValidate: true })
                }
                onValid={(value) =>
                  setValue('code', value, { shouldValidate: true })
                }
              />

              <TextField.Hint>
                <Trans i18nKey={'profile:verifyActivationCodeDescription'} />
              </TextField.Hint>

              {errors.code ? (
                <TextField.Error error={errors.code.message} />
              ) : null}
            </TextField.Label>

            <div className={'flex justify-end space-x-2'}>
              <Modal.CancelButton type={'button'} onClick={onCancel} />

              <Button
                disabled={!code || !!errors.code}
                loading={state.loading}
                type={'submit'}
              >
                {state.loading ? (
                  <Trans i18nKey={'profile:verifyingCode'} />
                ) : (
                  <Trans i18nKey={'profile:enableMfaFactor'} />
                )}
              </Button>
            </div>
          </div>
        </form>
      </If>
    </div>
  );
}
